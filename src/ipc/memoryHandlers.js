const memoriesRepository =
    require('../database/repositories/memories');

function registerMemoryHandlers(
    ipcMain
) {

    ipcMain.handle(
        'nova-create-memory',
        async (event, memory) => {

            try {

                const id =
                    memoriesRepository.createMemory(
                        memory.type,
                        memory.content,
                        memory.source ?? null,
                        memory.importance ?? 1
                    );

                return {
                    success: true,
                    id
                };

            } catch (error) {

                console.error(
                    'ERROR AL CREAR MEMORIA:',
                    error
                );

                return {
                    success: false,
                    error: error.message
                };
            }
        }
    );


    ipcMain.handle(
        'nova-get-memories',
        async () => {

            try {

                const memories =
                    memoriesRepository
                        .getAllMemories();

                return {
                    success: true,
                    memories
                };

            } catch (error) {

                console.error(
                    'ERROR AL OBTENER MEMORIAS:',
                    error
                );

                return {
                    success: false,
                    error: error.message
                };
            }
        }
    );


    ipcMain.handle(
        'nova-search-memories',
        async (event, query) => {

            try {

                const memories =
                    memoriesRepository
                        .searchMemories(
                            query
                        );

                return {
                    success: true,
                    memories
                };

            } catch (error) {

                console.error(
                    'ERROR AL BUSCAR MEMORIAS:',
                    error
                );

                return {
                    success: false,
                    error: error.message
                };
            }
        }
    );


    ipcMain.handle(
        'nova-update-memory',
        async (event, memory) => {

            try {

                return memoriesRepository
                    .updateMemory(
                        memory.id,
                        memory.content,
                        memory.type ?? null,
                        memory.source ?? null,
                        memory.importance ?? null
                    );

            } catch (error) {

                console.error(
                    'ERROR AL ACTUALIZAR MEMORIA:',
                    error
                );

                return {
                    success: false,
                    error: error.message
                };
            }
        }
    );


    ipcMain.handle(
        'nova-delete-memory',
        async (event, memoryId) => {

            try {

                const result =
                    memoriesRepository
                        .deleteMemory(
                            memoryId
                        );

                return {
                    success: true,
                    deleted: result.changes > 0
                };

            } catch (error) {

                console.error(
                    'ERROR AL ELIMINAR MEMORIA:',
                    error
                );

                return {
                    success: false,
                    error: error.message
                };
            }
        }
    );
}

module.exports = {
    registerMemoryHandlers
};