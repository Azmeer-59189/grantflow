"""Server-only access management; database RPC serializes changes and auditing."""
import logging
from typing import Literal
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from postgrest.exceptions import APIError
from api.auth import require_admin, user_role
from services.supabase_service import get_supabase_client

router = APIRouter(prefix='/api/access', tags=['Access management'])


class RoleChange(BaseModel):
    role: Literal['owner', 'admin', 'editor', 'viewer', 'disabled']


@router.get('/users')
def list_users(page: int = Query(1, ge=1), user=Depends(require_admin)):
    try:
        users = get_supabase_client().auth.admin.list_users(page=page, per_page=50)
        return [{'id': str(item.id), 'email': item.email, 'role': user_role(item)} for item in users]
    except Exception as error:
        logging.exception('Could not list workspace users')
        raise HTTPException(503, 'Could not load workspace users.') from error


@router.patch('/users/{target_id}')
def change_role(target_id: UUID, payload: RoleChange, user=Depends(require_admin)):
    try:
        return get_supabase_client().rpc('grantflow_change_role', {
            'actor': str(user.id), 'target': str(target_id), 'new_role': payload.role,
        }).execute().data
    except APIError as error:
        code = str(error.code)
        messages = {'42501': (403, 'You cannot change this account or assign that role.'),
                    '23514': (409, 'The last owner cannot be removed. Assign another owner first.'),
                    'P0002': (404, 'User not found.')}
        status, detail = messages.get(code, (503, 'Access management is unavailable. Check that the migration has been applied.'))
        raise HTTPException(status, detail) from error
    except Exception as error:
        logging.exception('Could not change workspace access')
        raise HTTPException(503, 'The role change could not be confirmed. Reload the user list before retrying.') from error


@router.get('/history')
def role_history(offset: int = Query(0, ge=0), user=Depends(require_admin)):
    try:
        return get_supabase_client().table('access_audit').select('*').order('created_at', desc=True).order('id').range(offset, offset + 49).execute().data
    except Exception as error:
        logging.exception('Could not load access history')
        raise HTTPException(503, 'Access history is unavailable.') from error
