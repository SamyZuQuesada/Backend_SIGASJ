import { ContenidoPublicoService } from './contenido-publico.service';
export declare class ContenidoPublicoController {
    private readonly contenidoPublicoService;
    constructor(contenidoPublicoService: ContenidoPublicoService);
    getPublicInformacion(): {
        asada: string;
        ubicacion: string;
        mision: string;
        vision: string;
        historia: string;
    };
    getPublicContacto(): {
        telefono: string;
        email: string;
        direccion: string;
        horarioAtencion: string;
    };
    getPublicGaleria(): {
        id: number;
        titulo: string;
        url: string;
        activa: boolean;
    }[];
    getPublicTransparencia(): {
        id: number;
        titulo: string;
        ano: number;
        documentoUrl: string;
    }[];
    getAdminInformacion(): {
        asada: string;
        ubicacion: string;
        mision: string;
        vision: string;
        historia: string;
    };
    getAdminContacto(): {
        telefono: string;
        email: string;
        direccion: string;
        horarioAtencion: string;
    };
}
