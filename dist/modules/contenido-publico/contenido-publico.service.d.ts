export declare class ContenidoPublicoService {
    getInformacionInstitucional(): {
        asada: string;
        ubicacion: string;
        mision: string;
        vision: string;
        historia: string;
    };
    getContacto(): {
        telefono: string;
        email: string;
        direccion: string;
        horarioAtencion: string;
    };
    getGaleria(): {
        id: number;
        titulo: string;
        url: string;
        activa: boolean;
    }[];
    getTransparencia(): {
        id: number;
        titulo: string;
        ano: number;
        documentoUrl: string;
    }[];
}
