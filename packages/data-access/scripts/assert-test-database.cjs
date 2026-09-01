const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to reset the integration test database.");
}

const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "");
if (!/(^|[_-])test($|[_-])/i.test(databaseName)) {
  throw new Error(
    `Refusing to reset non-test database \"${databaseName}\". Use a database name containing \"test\".`,
  );
}
