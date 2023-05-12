import { vertexShader, fragmentShader } from "./Shader";
import {
    createBuffer,
    initCanvas,
    initPipeline,
    initWebGPU,
    initBindGroupData,
    initBindGroupData2,
} from "./Utils";
import { create } from "../../../utils/Matrix4Utils";
import { addTime, showTime } from "../../../utils/CPUTimeUtils";
import { getSize } from "../../../utils/CanvasUtils";

// let _recordRenderPass = (device: GPUDevice, passEncoder: GPURenderBundleEncoder | GPURenderPassEncoder, pipeline: GPURenderPipeline, bindGroup: GPUBindGroup, vertexBuffer: GPUBuffer, indexBuffer: GPUBuffer, uniformBuffer: GPUBuffer, instanceCount: number, indexCount: number) => {
let _recordRenderPass = (
    device: GPUDevice,
    passEncoder: GPURenderBundleEncoder | GPURenderPassEncoder,
    pipeline: GPURenderPipeline,
    vertexBuffer: GPUBuffer,
    indexBuffer: GPUBuffer,
    [bindGroup, bindGroup2]: [GPUBindGroup, GPUBindGroup],
    instanceCount: number,
    indexCount: number
) => {
    passEncoder.setPipeline(pipeline);
    passEncoder.setVertexBuffer(0, vertexBuffer);

    passEncoder.setIndexBuffer(indexBuffer, "uint32");

    const uniformBytes = 16 * Float32Array.BYTES_PER_ELEMENT;
    const alignedUniformBytes = Math.ceil(uniformBytes / 256) * 256;
    const uniformBytes2 = 3 * Float32Array.BYTES_PER_ELEMENT;
    const alignedUniformBytes2 = Math.ceil(uniformBytes2 / 256) * 256;
    alignedUniformBytes2 / Float32Array.BYTES_PER_ELEMENT;

    for (let i = 0; i < instanceCount; ++i) {
        passEncoder.setBindGroup(0, bindGroup, [i * alignedUniformBytes]);

        passEncoder.setBindGroup(1, bindGroup2, [i * alignedUniformBytes2]);

        passEncoder.drawIndexed(indexCount, 1, 0, 0, 0);
    }
};

let main = async () => {
    let instanceCount = 70000;

    document.querySelector("#instance_count").innerHTML = String(instanceCount);

    const canvas: HTMLCanvasElement = initCanvas(
        document.querySelector("#canvas") as HTMLCanvasElement
    );
    const gpuContext: GPUCanvasContext = canvas.getContext(
        "webgpu"
    ) as GPUCanvasContext;

    const vertex = new Float32Array([
        0.0, 0.1, 0.0, -0.1, -0.1, 0.0, 0.1, -0.1, 0.0,
    ]);

    const index = new Uint32Array([0, 1, 2]);

    const { device, swapChain, swapChainFormat } = await initWebGPU(gpuContext);
    const vertexBuffer = createBuffer(device, vertex, GPUBufferUsage.VERTEX);
    const indexBuffer = createBuffer(device, index, GPUBufferUsage.INDEX);

    const uniformBytes = 16 * Float32Array.BYTES_PER_ELEMENT;
    const alignedUniformBytes = Math.ceil(uniformBytes / 256) * 256;
    const alignedUniformFloats =
        alignedUniformBytes / Float32Array.BYTES_PER_ELEMENT;

    const uniformBuffer = device.createBuffer({
        size: instanceCount * alignedUniformBytes,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
        mappedAtCreation: true,
    });

    const uniformBufferData = new Float32Array(
        instanceCount * alignedUniformFloats
    );

    for (let i = 0; i < instanceCount; i++) {
        uniformBufferData.set(create(), alignedUniformFloats * i);
    }

    new Float32Array(uniformBuffer.getMappedRange()).set(uniformBufferData, 0);
    uniformBuffer.unmap();

    const [layout, bindGroup] = initBindGroupData(device, uniformBuffer);

    const uniformBytes2 = 3 * Float32Array.BYTES_PER_ELEMENT;
    const alignedUniformBytes2 = Math.ceil(uniformBytes2 / 256) * 256;
    const alignedUniformFloats2 =
        alignedUniformBytes2 / Float32Array.BYTES_PER_ELEMENT;

    const uniformBuffer2 = device.createBuffer({
        size: instanceCount * alignedUniformBytes2,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
        mappedAtCreation: true,
    });

    const uniformBufferData2 = new Float32Array(
        instanceCount * alignedUniformFloats2
    );

    for (let i = 0; i < instanceCount; i++) {
        let random = Math.random();
        uniformBufferData2.set(
            [random, random, random],
            alignedUniformFloats2 * i
        );
    }

    new Float32Array(uniformBuffer2.getMappedRange()).set(
        uniformBufferData2,
        0
    );
    uniformBuffer2.unmap();

    const [layout2, bindGroup2] = initBindGroupData2(device, uniformBuffer2);
    const renderPipeline = initPipeline(
        device,
        [layout, layout2],
        vertexShader,
        fragmentShader,
        swapChainFormat
    );

    const renderBundleEncoder = device.createRenderBundleEncoder({
        colorFormats: [swapChainFormat],
    });
    _recordRenderPass(
        device,
        renderBundleEncoder,
        renderPipeline,
        vertexBuffer,
        indexBuffer,
        [bindGroup, bindGroup2],
        instanceCount,
        index.length
    );
    const renderBundle = renderBundleEncoder.finish();

    let cpuTimeSumArr: Array<number> = [];

    let copiedUniformBufferData2 = uniformBufferData2.slice();

    const render = () => {
        let n1 = performance.now();

        const commandEncoder = device.createCommandEncoder();
        const passEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view: swapChain.getCurrentTexture().createView(),
                    clearValue: { r: 0, g: 0, b: 0, a: 1.0 },
                    storeOp: "store",
                    loadOp: "clear",
                },
            ],
        });

        let [width, height] = getSize();
        passEncoder.setViewport(0, 0, width, height, 0, 1);

        let i = 0;

        while (i < 100) {
            let j = Math.ceil(Math.random() * 1000);

            let [r, g, b] = [
                copiedUniformBufferData2[alignedUniformFloats2 * j],
                copiedUniformBufferData2[alignedUniformFloats2 * j + 1],
                copiedUniformBufferData2[alignedUniformFloats2 * j + 2],
            ];

            let random = Math.random();

            uniformBufferData2.set(
                [r * random, g * random, b * random],
                alignedUniformFloats2 * j
            );

            device.queue.writeBuffer(
                uniformBuffer2,
                (instanceCount - j) * alignedUniformBytes2,
                uniformBufferData2.buffer,
                j * alignedUniformBytes2,
                1 * alignedUniformBytes2
            );

            i++;
        }

        passEncoder.executeBundles([renderBundle]);

        passEncoder.end();

        device.queue.submit([commandEncoder.finish()]);

        addTime(cpuTimeSumArr, n1);

        requestAnimationFrame(render);
    };

    render();

    showTime(cpuTimeSumArr);
};

window.addEventListener("DOMContentLoaded", main);
