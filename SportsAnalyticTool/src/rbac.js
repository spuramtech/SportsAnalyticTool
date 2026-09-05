const roles = {
  viewer: {
    label: 'Viewer',
    description: 'Read-only overview and team/player performance.',
    permissions: ['read:overview', 'read:players', 'read:teams'],
  },
  analyst: {
    label: 'Analyst',
    description: 'Performance analysis plus data-quality review.',
    permissions: ['read:overview', 'read:players', 'read:teams', 'read:quality'],
  },
  coach: {
    label: 'Coach',
    description: 'Player and team review for planning conversations.',
    permissions: ['read:overview', 'read:players', 'read:teams', 'read:player-detail'],
  },
  data_engineer: {
    label: 'Data Engineer',
    description: 'Source and quality operations without selection workflow.',
    permissions: ['read:overview', 'read:quality'],
  },
  admin: {
    label: 'Administrator',
    description: 'Full local pilot access.',
    permissions: ['read:overview', 'read:players', 'read:teams', 'read:quality', 'read:player-detail'],
  },
};

const defaultRole = 'analyst';

function getRole(request) {
  const requested = request.get('x-dev-role') || request.query.role || defaultRole;
  return roles[requested] ? requested : defaultRole;
}

function context(request) {
  const role = getRole(request);
  return { role, ...roles[role] };
}

function requirePermission(permission) {
  return (request, response, next) => {
    const user = context(request);
    response.locals.user = user;
    if (!user.permissions.includes(permission)) {
      return response.status(403).json({
        error: 'forbidden',
        message: `Role '${user.role}' does not have '${permission}'.`,
        role: user.role,
        requiredPermission: permission,
      });
    }
    next();
  };
}

module.exports = { roles, defaultRole, context, requirePermission };
