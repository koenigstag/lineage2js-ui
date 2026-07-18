const backgroundModules = import.meta.glob<string>("./*.{webp,png,jpg,jpeg}", {
  eager: true,
  import: "default",
});

const backgrounds = Object.values(backgroundModules);

export function getRandomLoginBackground(): string | undefined {
  if (backgrounds.length === 0) {
    return undefined;
  }

  return backgrounds[Math.floor(Math.random() * backgrounds.length)];
}
