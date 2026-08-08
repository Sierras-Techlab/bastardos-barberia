const COMBINING_MARKS = /[\u0300-\u036f]/g;
const NON_ALPHANUMERIC = /[^a-z0-9]+/g;

export const normalizeUsernameComponent = (value: string) =>
  value
    .trim()
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(NON_ALPHANUMERIC, "");

export const normalizeUsername = (firstName: string, lastName: string) => {
  const first = normalizeUsernameComponent(firstName);
  const last = normalizeUsernameComponent(lastName);

  if (!first || !last) {
    throw new Error("El nombre y el apellido deben contener letras o números.");
  }

  return `${first}.${last}`;
};
