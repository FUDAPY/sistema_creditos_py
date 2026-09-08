import type { Role } from '@syscreditos/shared';

/** Usuario autenticado (payload del JWT) adjuntado al request. */
export interface RequestUser {
  sub: string;
  uid: string;
  email: string;
  name: string;
  role: Role;
  companyId: string;
}
