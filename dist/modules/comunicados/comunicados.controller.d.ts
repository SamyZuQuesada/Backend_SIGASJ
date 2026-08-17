import { ComunicadosService } from './comunicados.service';
export declare class ComunicadosController {
    private readonly comunicadosService;
    constructor(comunicadosService: ComunicadosService);
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
