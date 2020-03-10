const hasPermissions = function hasPermissions(user, permissionsNeeded) {
  const permissionsMatched = user.permissions.some(permission =>
    permissionsNeeded.includes(permission)
  );
  if (!permissionsMatched)
    throw new Error(`You do not have sufficient permissions to do this action. 
      You need: ${permissionsNeeded};
      You have: ${user.permissions}`
    );
  return permissionsMatched;
};

module.exports = { hasPermissions };
