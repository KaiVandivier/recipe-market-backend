const checkPermissions = function checkPermissions(user, permissionsNeeded) {
  const permissionsMatched = user.permissions.some(permission =>
    permissionsNeeded.includes(permission)
  );
  if (!permissionsMatched)
    throw new Error(`You do not have sufficient permissions to do this action.
      You need at least one of: ${permissionsNeeded};
      You have: ${user.permissions}`
    );
  return permissionsMatched;
};

module.exports = { checkPermissions };
