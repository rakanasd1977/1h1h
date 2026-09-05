const { run, get } = require('../index');

module.exports = {
  name: "051_rbac_disputes",
  up: () => {
    const grants = { disputes: ['view', 'edit', 'export'] };
    const rolePerms = {
      super_admin: ['view', 'edit', 'export'],
      admin: ['view', 'edit', 'export'],
      manager: ['view', 'edit'],
      viewer: ['view'],
    };
    for (const [resource, actions] of Object.entries(grants)) {
      for (const [roleName, perms] of Object.entries(rolePerms)) {
        const role = get("SELECT id FROM admin_roles WHERE name = ?", [roleName]);
        if (!role) continue;
        for (const action of perms.filter((p) => actions.includes(p))) {
          run("INSERT OR IGNORE INTO admin_role_permissions (role_id, resource, action) VALUES (?,?,?)", [role.id, resource, action]);
        }
      }
    }
  },
  down: () => {
    run("DELETE FROM admin_role_permissions WHERE resource = 'disputes'");
  },
};