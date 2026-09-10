export type Role = 'ADMIN' | 'COLLECTOR';

export interface NavItem {
  label: string;
  path: string;
  icon?: string;
  roles?: Role[];
  children?: NavItem[];
}

export interface NavSection {
  title: string;
  roles?: Role[];
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'GENERAL',
    items: [
      { label: 'Dashboard', path: '/' },
      { label: 'Pago Rápido', path: '/pago-rapido' },
      { label: 'Calendario', path: '/calendario' },
    ],
  },
  {
    title: 'COBROS',
    items: [
      { label: 'Cartera Activa', path: '/cartera' },
      {
        label: 'Empresas',
        path: '/empresas',
        children: [
          { label: 'Créditos', path: '/empresas/creditos' },
          { label: 'Alquileres', path: '/empresas/alquileres' },
          { label: 'Empeños', path: '/empresas/empenos' },
          { label: 'Prestación', path: '/empresas/prestacion' },
          { label: 'Tragamonedas', path: '/empresas/tragamonedas' },
          { label: 'POS', path: '/empresas/pos' },
          { label: 'Jurídico', path: '/empresas/juridico' },
        ],
      },
    ],
  },
  {
    title: 'CLIENTES',
    items: [
      { label: 'Nuevo Cliente', path: '/clientes/nuevo' },
      { label: 'Nuevo Crédito', path: '/loans/new' },
      { label: 'Clasif. de Cartera', path: '/cartera/clasificacion' },
      { label: 'Pagarés', path: '/pagares' },
    ],
  },
  {
    title: 'ADMINISTRACIÓN',
    roles: ['ADMIN'],
    items: [
      { label: 'Aprobar Créditos', path: '/admin/aprobar-creditos' },
      { label: 'Aprobar Rendición', path: '/admin/aprobar-rendicion' },
      { label: 'Recaudo', path: '/admin/recaudo' },
    ],
  },
  {
    title: 'USUARIOS',
    roles: ['ADMIN'],
    items: [{ label: 'Gestión de Usuarios', path: '/admin/usuarios' }],
  },
];

export const canAccess = (role: Role | undefined, roles?: Role[]) =>
  !roles || roles.length === 0 || (role != null && roles.includes(role));
