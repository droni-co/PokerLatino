/*
|--------------------------------------------------------------------------
| Validator file
|--------------------------------------------------------------------------
|
| The validator file is used for configuring global transforms for VineJS.
| The transform below converts all VineJS date outputs from JavaScript
| Date objects to Luxon DateTime instances, so that validated dates are
| ready to use with Lucid models and other parts of the app that expect
| Luxon DateTime.
|
*/

import { DateTime } from 'luxon'
import { VineDate } from '@vinejs/vine'

declare module '@vinejs/vine/types' {
  interface VineGlobalTransforms {
    date: DateTime
  }
}

VineDate.transform((value) => DateTime.fromJSDate(value))

/**
 * Mensajes de validación en español
 */
import vine, { SimpleMessagesProvider } from '@vinejs/vine'

vine.messagesProvider = new SimpleMessagesProvider(
  {
    'required': 'Este campo es obligatorio',
    'email': 'Ingresa un email válido',
    'minLength': 'Debe tener al menos {{ min }} caracteres',
    'maxLength': 'Debe tener como máximo {{ max }} caracteres',
    'confirmed': 'Las contraseñas no coinciden',
    'database.unique': 'Ya existe una cuenta con este email',
    'date': 'Ingresa una fecha válida',
    'birth_date.date.beforeOrEqual': 'Debes ser mayor de edad para registrarte',
    'birth_date.date.afterOrEqual': 'Ingresa una fecha de nacimiento válida',
  },
  {
    email: 'email',
    password: 'contraseña',
    birth_date: 'fecha de nacimiento',
  }
)
