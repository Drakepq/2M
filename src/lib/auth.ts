import { supabase } from './supabase'

/**
 * Consulta el rol usando las tablas:
 * usuarios_roles(user_id, role_id)
 * roles(id, name)
 *
 * No basta con que el usuario haya iniciado sesión:
 * también debe tener el rol "admin" en Supabase.
 * (Las tablas se crean con supabase_setup.sql)
 */
export async function checkAdminRole(userId: string): Promise<boolean> {
  const { data: userRoles, error: userRolesError } = await supabase
    .from('usuarios_roles')
    .select('role_id')
    .eq('user_id', userId)

  if (userRolesError) throw userRolesError

  const roleIds = (userRoles ?? [])
    .map((item) => item.role_id)
    .filter((id): id is string => Boolean(id))

  if (roleIds.length === 0) return false

  const { data: roles, error: rolesError } = await supabase
    .from('roles')
    .select('id, name')
    .in('id', roleIds)

  if (rolesError) throw rolesError

  return (roles ?? []).some((role) => role.name?.toLowerCase() === 'admin')
}
