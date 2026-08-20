import { GaleriaFoto } from '../entities/galeria-foto.entity';

export type PublicGaleriaFotoDto = {
  id: string;
  imageUrl: string;
  altText: string;
  title?: string;
  description?: string;
};

export type AdminGaleriaFotoDto = {
  id: number;
  titulo: string | null;
  descripcion: string | null;
  imagenUrl: string;
  textoAlternativo: string;
  ordenVisualizacion: number;
  activo: boolean;
};

export function toPublicGaleriaFotoDto(
  photo: GaleriaFoto,
): PublicGaleriaFotoDto {
  return {
    id: String(photo.idGaleriaFoto),
    imageUrl: photo.imagenUrl,
    altText: photo.textoAlternativo,
    ...(photo.titulo ? { title: photo.titulo } : {}),
    ...(photo.descripcion ? { description: photo.descripcion } : {}),
  };
}

export function toAdminGaleriaFotoDto(
  photo: GaleriaFoto,
): AdminGaleriaFotoDto {
  return {
    id: photo.idGaleriaFoto,
    titulo: photo.titulo,
    descripcion: photo.descripcion,
    imagenUrl: photo.imagenUrl,
    textoAlternativo: photo.textoAlternativo,
    ordenVisualizacion: photo.ordenVisualizacion,
    activo: photo.activo,
  };
}
