import type { FaceLivenessDetectorCoreProps } from '@aws-amplify/ui-react-liveness';

/**
 * Tipo de los textos del componente. En 3.6.8 `LivenessDisplayText` no se
 * exporta desde la raíz del paquete; se deriva de la prop `displayText` del
 * componente público, que sí está exportada.
 */
export type LivenessDisplayText = NonNullable<FaceLivenessDetectorCoreProps['displayText']>;

/**
 * Traducciones al español (voseo formal de kiosco) para FaceLivenessDetectorCore.
 * La 3.6.8 internacionaliza únicamente vía la prop `displayText`; las claves
 * no provistas caen al texto por defecto en inglés.
 */
export const LIVENESS_DISPLAY_TEXT_ES: LivenessDisplayText = {
  // ── HintDisplayText ──────────────────────────────────────────────────────
  hintMoveFaceFrontOfCameraText: 'Coloque su rostro frente a la cámara',
  hintTooManyFacesText: 'Asegúrese de que solo haya un rostro frente a la cámara',
  hintFaceDetectedText: 'Rostro detectado',
  hintCanNotIdentifyText: 'Coloque su rostro frente a la cámara',
  hintTooCloseText: 'Aléjese un poco de la cámara',
  hintTooFarText: 'Acérquese a la cámara',
  hintConnectingText: 'Conectando...',
  hintVerifyingText: 'Verificando identidad...',
  hintCheckCompleteText: 'Verificación completada',
  hintIlluminationTooBrightText: 'Diríjase a un área con menos luz',
  hintIlluminationTooDarkText: 'Diríjase a un área con más luz',
  hintIlluminationNormalText: 'Condiciones de iluminación adecuadas',
  hintHoldFaceForFreshnessText: 'Permanezca quieto',
  hintCenterFaceText: 'Centre su rostro en el óvalo',
  hintCenterFaceInstructionText:
    'Instrucción: antes de comenzar, asegúrese de que la cámara esté en la parte superior central de su pantalla y centre su rostro hacia la cámara. Al iniciar la verificación aparecerá un óvalo en el centro. Se le pedirá que avance hasta el óvalo y luego que permanezca quieto. Después de unos segundos escuchará que la verificación ha concluido.',
  hintFaceOffCenterText: 'Su rostro no está dentro del óvalo; centre su rostro hacia la cámara.',
  hintMatchIndicatorText: 'Progreso 50%. Continúe acercándose.',

  // ── CameraDisplayText ────────────────────────────────────────────────────
  cameraMinSpecificationsHeadingText: 'La cámara no cumple con las especificaciones mínimas',
  cameraMinSpecificationsMessageText:
    'La cámara debe soportar al menos resolución de 320×240 y 15 cuadros por segundo.',
  cameraNotFoundHeadingText: 'No se encontró una cámara',
  cameraNotFoundMessageText:
    'Verifique que haya una cámara conectada y que ninguna otra aplicación la esté usando. Es posible que deba otorgar los permisos de cámara desde la configuración, cerrar el navegador por completo e intentar nuevamente.',
  retryCameraPermissionsText: 'Reintentar',
  waitingCameraPermissionText: 'Esperando que conceda el permiso de cámara.',
  a11yVideoLabelText: 'Cámara web para la verificación biométrica',

  // ── InstructionDisplayText ───────────────────────────────────────────────
  goodFitCaptionText: 'Encuadre correcto',
  goodFitAltText: 'Ilustración del rostro de una persona ajustado perfectamente dentro de un óvalo.',
  photosensitivityWarningBodyText:
    'Esta verificación emite destellos de distintos colores. Tenga precaución si es fotosensible.',
  photosensitivityWarningHeadingText: 'Advertencia de fotosensibilidad',
  photosensitivityWarningInfoText:
    'Algunas personas pueden sufrir convulsiones epilépticas al exponerse a luces de colores. Tenga precaución si usted o algún familiar padece epilepsia.',
  photosensitivityWarningLabelText: 'Más información sobre la fotosensibilidad',
  startScreenBeginCheckText: 'Iniciar verificación',
  tooFarCaptionText: 'Demasiado lejos',
  tooFarAltText:
    'Ilustración del rostro de una persona dentro de un óvalo; hay un espacio entre el contorno del rostro y los bordes del óvalo.',
  photosensitivyWarningBodyText:
    'Esta verificación emite destellos de distintos colores. Tenga precaución si es fotosensible.',
  photosensitivyWarningHeadingText: 'Advertencia de fotosensibilidad',
  photosensitivyWarningInfoText:
    'Algunas personas pueden sufrir convulsiones epilépticas al exponerse a luces de colores. Tenga precaución si usted o algún familiar padece epilepsia.',
  photosensitivyWarningLabelText: 'Más información sobre la fotosensibilidad',

  // ── StreamDisplayText ────────────────────────────────────────────────────
  recordingIndicatorText: 'GRAB',
  cancelLivenessCheckText: 'Cancelar verificación',

  // ── ErrorDisplayText ─────────────────────────────────────────────────────
  errorLabelText: 'Error',
  connectionTimeoutHeaderText: 'La conexión se agotó',
  connectionTimeoutMessageText: 'El tiempo de conexión se agotó.',
  timeoutHeaderText: 'Tiempo agotado',
  timeoutMessageText:
    'El rostro no encajó dentro del óvalo en el tiempo límite. Intente nuevamente y llene el óvalo por completo con su rostro.',
  faceDistanceHeaderText: 'Movimiento hacia adelante detectado',
  faceDistanceMessageText: 'Evite acercarse mientras se realiza la conexión.',
  multipleFacesHeaderText: 'Se detectaron varios rostros',
  multipleFacesMessageText:
    'Asegúrese de que solo haya un rostro frente a la cámara durante la conexión.',
  clientHeaderText: 'Error del dispositivo',
  clientMessageText: 'La verificación falló por un problema del dispositivo.',
  serverHeaderText: 'Problema del servidor',
  serverMessageText: 'No se pudo completar la verificación por un problema del servidor.',
  landscapeHeaderText: 'Orientación horizontal no compatible',
  landscapeMessageText: 'Gire el dispositivo a la orientación vertical.',
  portraitMessageText: 'Mantenga el dispositivo en orientación vertical durante toda la verificación.',
  tryAgainText: 'Intentar nuevamente',
};
