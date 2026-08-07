(() => {
    "use strict";

    const SOFTWARE_RENDERER_PATTERN =
        /swiftshader|llvmpipe|software|microsoft basic render/i;

    function markCanvas(canvas, backend, acceleration) {
        canvas.classList.add("game-canvas-gpu");
        canvas.dataset.renderBackend = backend;
        canvas.dataset.gpuAcceleration = acceleration;
    }

    function create2DContext(canvas, options = {}) {
        const attributes = {
            alpha: options.alpha ?? false,
            desynchronized: options.desynchronized ?? true,
            willReadFrequently: false,
        };
        const context = canvas.getContext("2d", attributes) ||
            canvas.getContext("2d", { alpha: attributes.alpha });

        if (context) {
            const actual = context.getContextAttributes?.();
            markCanvas(
                canvas,
                "canvas-2d",
                actual?.desynchronized ? "low-latency" : "composited",
            );
        }
        return context;
    }

    function getWebGLAcceleration(gl) {
        const extension = gl.getExtension("WEBGL_debug_renderer_info");
        if (!extension) {
            return "requested";
        }
        const renderer = gl.getParameter(
            extension.UNMASKED_RENDERER_WEBGL,
        );
        return SOFTWARE_RENDERER_PATTERN.test(String(renderer))
            ? "software"
            : "hardware";
    }

    function createWebGLContext(canvas, options = {}) {
        const attributes = {
            alpha: false,
            antialias: true,
            depth: true,
            stencil: false,
            desynchronized: true,
            failIfMajorPerformanceCaveat: false,
            powerPreference: "high-performance",
            premultipliedAlpha: false,
            preserveDrawingBuffer: false,
            ...options,
        };
        const context = canvas.getContext("webgl", attributes) ||
            canvas.getContext("experimental-webgl", attributes);

        if (context) {
            markCanvas(
                canvas,
                "webgl",
                getWebGLAcceleration(context),
            );
        }
        return context;
    }

    window.GameGpuRuntime = Object.freeze({
        create2DContext,
        createWebGLContext,
        getWebGLAcceleration,
    });
})();
