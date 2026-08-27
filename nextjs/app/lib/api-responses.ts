export const invalidInputResponse = (message: string) =>
  Response.json({ error: message }, { status: 400 });

export const databaseFailureResponse = () =>
  Response.json({ error: "Database query failed" }, { status: 500 });
