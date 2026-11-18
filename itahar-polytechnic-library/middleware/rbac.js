function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    const userRole = (req.user.role || '').toLowerCase();
    const authorized = allowedRoles.map(r => r.toLowerCase()).includes(userRole);

    if (!authorized) {
      return res.status(403).json({
        success: false,
        message: `Access denied. This action requires one of the following roles: [${allowedRoles.join(', ')}]. You are logged in as [${userRole}].`
      });
    }

    next();
  };
}

module.exports = {
  requireRole
};
