import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

const FECHA_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export type FechaActividadValidationError =
  | 'formato'
  | 'calendario'
  | 'futura';

export const parseFechaActividad = (
  value: string,
): { year: number; month: number; day: number } | null => {
  const match = FECHA_PATTERN.exec(value);
  if (!match) {
    return null;
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
};

export const getFechaActividadValidationError = (
  value: unknown,
  now: Date = new Date(),
): FechaActividadValidationError | null => {
  if (typeof value !== 'string') {
    return 'formato';
  }

  const trimmed = value.trim();
  if (!FECHA_PATTERN.test(trimmed)) {
    return 'formato';
  }

  const parsed = parseFechaActividad(trimmed);
  if (!parsed) {
    return 'calendario';
  }

  const todayUtc = Date.UTC(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const valueUtc = Date.UTC(parsed.year, parsed.month - 1, parsed.day);
  if (valueUtc > todayUtc) {
    return 'futura';
  }

  return null;
};

export const isFechaActividadValida = (
  value: unknown,
  now: Date = new Date(),
): boolean => getFechaActividadValidationError(value, now) === null;

const defaultMessage = (error: FechaActividadValidationError): string => {
  switch (error) {
    case 'formato':
      return 'La fecha de la actividad debe tener formato YYYY-MM-DD';
    case 'calendario':
      return 'La fecha de la actividad no es una fecha válida';
    case 'futura':
      return 'La fecha de la actividad no puede ser futura';
    default:
      return 'La fecha de la actividad no es válida';
  }
};

export const IsFechaActividadValida = (
  validationOptions?: ValidationOptions,
) => {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isFechaActividadValida',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return isFechaActividadValida(value);
        },
        defaultMessage(args: ValidationArguments) {
          const error = getFechaActividadValidationError(args.value);
          return error ? defaultMessage(error) : 'La fecha de la actividad no es válida';
        },
      },
    });
  };
};
