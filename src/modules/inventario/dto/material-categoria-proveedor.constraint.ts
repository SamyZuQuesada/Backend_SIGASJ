import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

function resolvedId(
  object: Record<string, unknown>,
  primary: string,
  alias: string,
): unknown {
  return object[primary] ?? object[alias];
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

@ValidatorConstraint({ name: 'materialCategoriaRequerida', async: false })
export class MaterialCategoriaRequeridaConstraint implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments): boolean {
    const object = args.object as Record<string, unknown>;
    return isPositiveInt(resolvedId(object, 'idCategoria', 'categoriaId'));
  }

  defaultMessage(): string {
    return 'La categoría del material es obligatoria';
  }
}

@ValidatorConstraint({ name: 'materialProveedorRequerido', async: false })
export class MaterialProveedorRequeridoConstraint implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments): boolean {
    const object = args.object as Record<string, unknown>;
    return isPositiveInt(resolvedId(object, 'idProveedor', 'proveedorId'));
  }

  defaultMessage(): string {
    return 'El proveedor del material es obligatorio';
  }
}
