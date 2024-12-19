function checkEnv(envName: string, envVar: unknown): asserts envVar is string {
  if (!envVar) {
    console.error(`Ошибка при получении переменной окружения ${envName}`);
    process.exit(1);
  }
}

export { checkEnv };