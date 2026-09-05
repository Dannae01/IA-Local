const fs = require('fs');
const path = require('path');

const {
    PDFParse
} = require('pdf-parse');const mammoth = require('mammoth');
const xlsx = require('xlsx');
const pptx2json = require('pptx2json');


async function extractText(filePath) {

    const extension =
        path.extname(filePath).toLowerCase();


    // TXT / MD / CSV

    if (
        extension === '.txt' ||
        extension === '.md' ||
        extension === '.csv'
    ) {

        return fs.readFileSync(
            filePath,
            'utf-8'
        );
    }


    // PDF

    if (extension === '.pdf') {

        const parser =
            new PDFParse({
                data: fs.readFileSync(filePath)
            });

        try {

            const result =
                await parser.getText();

            return result.text;

        } finally {

            await parser.destroy();

        }
    }


    // DOCX

    if (extension === '.docx') {

        const result =
            await mammoth.extractRawText({
                path: filePath
            });

        return result.value;
    }


    // XLSX

    if (extension === '.xlsx') {

        const workbook =
            xlsx.readFile(filePath);

        let text = '';

        for (
            const sheetName of workbook.SheetNames
        ) {

            const sheet =
                workbook.Sheets[sheetName];

            text +=
                `\n--- ${sheetName} ---\n`;

            text +=
                xlsx.utils.sheet_to_csv(sheet);
        }

        return text;
    }


    // PPTX

    if (extension === '.pptx') {

        const presentation =
            await pptx2json.parse(filePath);

        let text = '';

        for (
            const slide of presentation.slides || []
        ) {

            for (
                const shape of slide.shapes || []
            ) {

                if (shape.text) {
                    text +=
                        shape.text + '\n';
                }

            }
        }

        return text;
    }


    throw new Error(
        `Formato no compatible: ${extension}`
    );
}


module.exports = {
    extractText
};