function renderMarkdown(content) {
    if (typeof content !== 'string') {
        return '';
    }

    const html = marked.parse(content, {
        gfm: true,
        breaks: true
    });

    return DOMPurify.sanitize(html);
}

function enhanceCodeBlocks(element) {
    const codeBlocks =
        element.querySelectorAll('pre code');

    codeBlocks.forEach((codeElement) => {
        if (window.hljs) {
            hljs.highlightElement(codeElement);
        }

        const pre =
            codeElement.parentElement;

        if (
            !pre ||
            pre.querySelector('.code-copy-button')
        ) {
            return;
        }

        const languageClass =
            Array.from(codeElement.classList)
                .find((className) =>
                    className.startsWith('language-')
                );

        const language =
            languageClass
                ? languageClass.replace('language-', '')
                : 'texto';

        const label =
            document.createElement('span');

        label.className =
            'code-language-label';

        label.textContent =
            language;

        pre.appendChild(label);

        const button =
            document.createElement('button');

        button.className =
            'code-copy-button';

        button.textContent =
            'Copiar';

        button.addEventListener(
            'click',
            async () => {
                try {
                    await navigator.clipboard.writeText(
                        codeElement.textContent
                    );

                    button.textContent =
                        'Copiado';

                    setTimeout(() => {
                        button.textContent =
                            'Copiar';
                    }, 1500);
                } catch (error) {
                    console.error(
                        'No se pudo copiar el código:',
                        error
                    );
                }
            }
        );

        pre.appendChild(button);
    });
}

function renderAssistantMessage(
    element,
    content
) {
    element.innerHTML =
        renderMarkdown(content);

    enhanceCodeBlocks(element);
    enhanceTables(element);
}

function enhanceTables(element) {
    const tables =
        element.querySelectorAll('table');

    tables.forEach((table) => {
        if (
            table.parentElement?.classList
                .contains('table-wrapper')
        ) {
            return;
        }

        const wrapper =
            document.createElement('div');

        wrapper.className =
            'table-wrapper';

        table.parentNode.insertBefore(
            wrapper,
            table
        );

        wrapper.appendChild(table);
    });
}

function renderImage(
    element,
    image
) {
    if (
        !image ||
        typeof image.dataUrl !== 'string'
    ) {
        return;
    }

    if (image.missing) {
        const missing =
            document.createElement('div');

        missing.className =
            'nova-image-missing';

        missing.textContent =
            `Imagen no disponible: ${image.name || 'archivo desconocido'}`;

        element.appendChild(
            missing
        );

        return;
    }

    const container =
        document.createElement('div');

    container.className =
        'nova-image-container';

    const img =
        document.createElement('img');

    img.className =
        'nova-chat-image';

    img.src =
        image.dataUrl;

    img.alt =
        image.name || 'Imagen';

    img.loading =
        'lazy';

    container.appendChild(img);

    if (image.id) {
        const deleteButton =
            document.createElement(
                'button'
            );

        deleteButton.className =
            'nova-image-delete';

        deleteButton.textContent =
            '×';

        deleteButton.title =
            'Eliminar imagen';

        deleteButton.addEventListener(
            'click',
            async () => {

                const confirmed =
                    confirm(
                        `¿Eliminar "${image.name || 'esta imagen'}" de NOVA?`
                    );

                if (!confirmed) {
                    return;
                }

                try {
                    const result =
                        await window.nova
                            .deleteAttachment(
                                image.id
                            );

                    if (!result.success) {
                        throw new Error(
                            result.error ||
                            'No se pudo eliminar la imagen.'
                        );
                    }

                    container.remove();

                } catch (error) {
                    console.error(
                        'ERROR AL ELIMINAR IMAGEN:',
                        error
                    );

                    alert(
                        error.message
                    );
                }
            }
        );

        container.appendChild(
            deleteButton
        );
    }

    element.appendChild(container);
}

window.novaResponseRenderer = {
    renderAssistantMessage,
    renderImage
};