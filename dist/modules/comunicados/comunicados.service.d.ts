export declare class ComunicadosService {
    private comunicados;
    findPublicos(): {
        id: string;
        titulo: string;
        descripcion: string;
        tipo: string;
        prioridad: string;
        estado: string;
        esPublico: boolean;
        fechaPublicacion: string;
        fechaExpiracion: null;
    }[];
    findAllAdmin(): {
        id: string;
        titulo: string;
        descripcion: string;
        tipo: string;
        prioridad: string;
        estado: string;
        esPublico: boolean;
        fechaPublicacion: string;
        fechaExpiracion: null;
    }[];
    findOne(id: string): {
        id: string;
        titulo: string;
        descripcion: string;
        tipo: string;
        prioridad: string;
        estado: string;
        esPublico: boolean;
        fechaPublicacion: string;
        fechaExpiracion: null;
    };
}
