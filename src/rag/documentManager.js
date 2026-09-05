const path = require('path');
const fs = require('fs');

const { extractText } = require('./textExtractor');


const SUPPORTED_EXTENSIONS = [
    '.txt',
    '.md',
    '.csv',
    '.pdf',
    '.docx',
    '.pptx',
    '.xlsx'
];


function isSupportedFile(filePath) {

    const extension =
        path.extname(filePath).toLowerCase();

    return SUPPORTED_EXTENSIONS.includes(
        extension
    );
}


function cleanText(text) {

    if (!text) {
        return '';
    }

    return text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}


async function processDocument(filePath) {

    if (!filePath) {
        throw new Error(
            'No se indicó ningún archivo.'
        );
    }


    if (!fs.existsSync(filePath)) {
        throw new Error(
            'El archivo no existe.'
        );
    }


    if (!isSupportedFile(filePath)) {

        throw new Error(
            'El formato del archivo no es compatible.'
        );
    }


    const text =
        await extractText(filePath);


    const cleanedText =
        cleanText(text);


    if (!cleanedText) {

        throw new Error(
            'No se pudo extraer texto del documento.'
        );
    }


    const stats =
        fs.statSync(filePath);


    return {

        name:
            path.basename(filePath),

        path:
            filePath,

        extension:
            path.extname(filePath).toLowerCase(),

        size:
            stats.size,

        text:
            cleanedText,

        characters:
            cleanedText.length

    };
}


module.exports = {
    processDocument,
    isSupportedFile,
    cleanText
};