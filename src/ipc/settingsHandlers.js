const ollama =
    require('../ai/ollama');

const settings =
    require('../database/repositories/settings');

function registerSettingsHandlers(
    ipcMain
) {

    ipcMain.handle(
        'nova-get-models',
        async () => {

            try {

                return await ollama.getModels();

            } catch (error) {

                console.error(
                    'ERROR AL OBTENER MODELOS:',
                    error
                );

                return [];

            }

        }
    );


    ipcMain.handle(
        'nova-set-model',
        async (event, model) => {

            try {

                settings.setSetting(
                    'selected_model',
                    model
                );

                return true;

            } catch (error) {

                console.error(
                    'ERROR AL GUARDAR MODELO:',
                    error
                );

                return false;
            }

        }
    );


    ipcMain.handle(
        'nova-get-selected-model',
        async () => {

            try {

                return (
                    settings.getSetting(
                        'selected_model'
                    ) ||
                    'qwen2.5:14b'
                );

            } catch (error) {

                console.error(
                    'ERROR AL OBTENER MODELO SELECCIONADO:',
                    error
                );

                return 'qwen2.5:14b';
            }

        }
    );


    ipcMain.handle(
        'nova-set-temperature',
        async (event, value) => {

            try {

                const temperature =
                    parseFloat(value);

                console.log(
                    'GUARDANDO TEMPERATURA:',
                    temperature
                );

                if (isNaN(temperature)) {
                    return false;
                }

                settings.setSetting(
                    'temperature',
                    temperature.toString()
                );

                return true;

            } catch (error) {

                console.error(
                    'ERROR AL GUARDAR TEMPERATURA:',
                    error
                );

                return false;
            }

        }
    );


    ipcMain.handle(
        'nova-get-temperature',
        async () => {

            try {

                const savedTemperature =
                    settings.getSetting(
                        'temperature'
                    );

                console.log(
                    'TEMPERATURA GUARDADA EN SQLITE:',
                    savedTemperature
                );

                return savedTemperature || '0.7';

            } catch (error) {

                console.error(
                    'ERROR AL OBTENER TEMPERATURA:',
                    error
                );

                return '0.7';
            }

        }
    );


    ipcMain.handle(
        'nova-set-context-size',
        async (event, value) => {

            try {

                const contextSize =
                    parseInt(
                        value,
                        10
                    );

                if (isNaN(contextSize)) {
                    return false;
                }

                settings.setSetting(
                    'context_size',
                    contextSize.toString()
                );

                console.log(
                    'TAMAÑO DE CONTEXTO GUARDADO:',
                    contextSize
                );

                return true;

            } catch (error) {

                console.error(
                    'ERROR AL GUARDAR TAMAÑO DE CONTEXTO:',
                    error
                );

                return false;

            }

        }
    );


    ipcMain.handle(
        'nova-get-context-size',
        async () => {

            try {

                const savedContextSize =
                    settings.getSetting(
                        'context_size'
                    );

                console.log(
                    'TAMAÑO DE CONTEXTO GUARDADO EN SQLITE:',
                    savedContextSize
                );

                return savedContextSize || '8192';

            } catch (error) {

                console.error(
                    'ERROR AL CARGAR TAMAÑO DE CONTEXTO:',
                    error
                );

                return '8192';

            }

        }
    );

}

module.exports = {
    registerSettingsHandlers
};