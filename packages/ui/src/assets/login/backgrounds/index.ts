import defaultBackground from "../default-background.png";

const backgroundModules = import.meta.glob<string>("./*.{webp,png,jpg,jpeg}", {
  eager: true,
  import: "default",
});

const backgrounds = Object.values(backgroundModules);

export function getRandomLoginBackground(): string {
  if (backgrounds.length === 0) {
    return defaultBackground;
  }

  return backgrounds[Math.floor(Math.random() * backgrounds.length)];
}
