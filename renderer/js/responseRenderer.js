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

    element.appendChild(container);
}

window.novaResponseRenderer = {
    renderAssistantMessage,
    renderImage
};