// TEMPORARY diagnostic function -- delete once the admin login mismatch is
// resolved. Reveals only whether ADMIN_ACCESS_CODE is visible to functions
// at runtime and its length, never the actual value.

exports.handler = async () => {
  const val = process.env.ADMIN_ACCESS_CODE;
  return {
    statusCode: 200,
    body: JSON.stringify({
      isSet: typeof val === "string" && val.length > 0,
      length: typeof val === "string" ? val.length : 0,
      hasLeadingOrTrailingWhitespace: typeof val === "string" ? val !== val.trim() : false,
    }),
  };
};
