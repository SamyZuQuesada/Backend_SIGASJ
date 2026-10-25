import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';
import { validarListaCorreosAviso } from './correos-aviso.util';

export function IsListaCorreosAviso(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'isListaCorreosAviso',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return validarListaCorreosAviso(value) === null;
        },
        defaultMessage(args: ValidationArguments): string {
          return (
            validarListaCorreosAviso(args.value) ??
            'El correo electrónico no es válido'
          );
        },
      },
    });
  };
}
