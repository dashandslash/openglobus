import {Program} from "../webgl/Program";
import geoObjectVert from '../shaders/geoObject.vert.glsl';

const QROT = `vec3 qRotate(vec4 q, vec3 v){
    return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
}`;

export const geo_object = (): Program =>
    new Program("geo_object", {
        uniforms: {
            viewMatrix: "mat4",
            projectionMatrix: "mat4",

            uScaleByDistance: "vec3",

            eyePositionHigh: "vec3",
            eyePositionLow: "vec3",

            rtcEyePositionHigh: "vec3",
            rtcEyePositionLow: "vec3",

            sunPosition: "vec3",
            materialParams: "vec3",
            materialShininess: "float",

            uTexture: "sampler2d",
            uUseTexture: "float",
            useLighting: "float"
        },
        attributes: {
            aVertexPosition: "vec3",
            aVertexNormal: "vec3",
            aTexCoord: "vec2",

            aLocalPosition: {type: "vec3", divisor: 1},

            aRTCPositionHigh: {type: "vec3", divisor: 1},
            aRTCPositionLow: {type: "vec3", divisor: 1},

            aColor: {type: "vec4", divisor: 1},
            aScale: {type: "vec3", divisor: 1},
            aTranslate: {type: "vec3", divisor: 1},
            aDispose: {type: "float", divisor: 1},
            qRot: {type: "vec4", divisor: 1}
        },
        vertexShader: geoObjectVert,

        fragmentShader: `precision highp float;
                
                uniform vec3 sunPosition;
                uniform vec3 materialParams[3];
                uniform float materialShininess;
                uniform sampler2D uTexture;
                uniform float uUseTexture;
                uniform float useLighting;                
                            
                varying vec3 cameraPosition;
                varying vec3 v_vertex;                
                varying vec4 vColor;
                varying vec3 vNormal;
                varying vec2 vTexCoords;
                
                void main(void) {        
                                        
                    vec3 lightWeighting = vec3(1.0);
                
                    if(useLighting != 0.0){
                        vec3 normal = vNormal;
                        vec3 lightDir = normalize(sunPosition);
                        vec3 viewDir = normalize(cameraPosition - v_vertex);                
                        vec3 reflectionDirection = reflect(-lightDir, normal);
                        float reflection = max( dot(reflectionDirection, viewDir), 0.0);
                        float specularLightWeighting = pow( reflection, materialShininess);                                        
                        float diffuseLightWeighting = max(dot(normal, lightDir), 0.0);
                        lightWeighting = vColor.rgb * materialParams[0] + materialParams[1] * diffuseLightWeighting + materialParams[2] * specularLightWeighting;
                    } else {
                        lightWeighting = vColor.rgb;
                    }
                                       
                    if(uUseTexture > 0.0) {
                        vec4 texColor = texture2D(uTexture, vTexCoords);
                        gl_FragColor = vec4(texColor.rgb * lightWeighting, texColor.a);
                    } else {
                        gl_FragColor = vec4(lightWeighting, vColor.a);
                    }
                }`
    });

export const geo_object_picking = (): Program =>
    new Program("geo_object_picking", {
        uniforms: {
            viewMatrix: "mat4",
            projectionMatrix: "mat4",
            uScaleByDistance: "vec3",
            pickingScale: "vec3",
            rtcEyePositionHigh: "vec3",
            rtcEyePositionLow: "vec3",
        },
        attributes: {
            aVertexPosition: "vec3",
            aRTCPositionHigh: {type: "vec3", divisor: 1},
            aRTCPositionLow: {type: "vec3", divisor: 1},
            aPickingColor: {type: "vec3", divisor: 1},
            aScale: {type: "vec3", divisor: 1},
            aTranslate: {type: "vec3", divisor: 1},
            aLocalPosition: {type: "vec3", divisor: 1},
            aDispose: {type: "float", divisor: 1},
            qRot: {type: "vec4", divisor: 1}
        },
        vertexShader: `precision highp float;

            attribute vec3 aVertexPosition;
            attribute vec3 aRTCPositionHigh;
            attribute vec3 aRTCPositionLow;
            attribute vec3 aPickingColor;    
            attribute vec3 aScale;
            attribute vec3 aTranslate;
            attribute float aDispose;
            attribute vec4 qRot;
            
            attribute vec3 aLocalPosition;
            
            uniform vec3 rtcEyePositionHigh;
            uniform vec3 rtcEyePositionLow;
            
            uniform vec3 uScaleByDistance;
            uniform mat4 projectionMatrix;
            uniform mat4 viewMatrix;
            uniform vec3 pickingScale;

            varying vec3 vColor;
            
            ${QROT}

            void main(void) {

                if (aDispose == 0.0) {
                    return;
                }          
                
                vColor = aPickingColor;
                 
                mat4 viewMatrixRTE = viewMatrix;
                viewMatrixRTE[3] = vec4(0.0, 0.0, 0.0, 1.0);
                
                vec3 highDiff = aRTCPositionHigh - rtcEyePositionHigh;
                vec3 lowDiff = aRTCPositionLow - rtcEyePositionLow;  
                
                highDiff = highDiff * step(1.0, length(highDiff));
                
                vec4 positionInViewSpace = viewMatrixRTE * vec4(highDiff + lowDiff, 1.0);

                float lookLength = length(positionInViewSpace.xyz);
                                
                float scd = uScaleByDistance[2] * clamp(lookLength, uScaleByDistance[0], uScaleByDistance[1]) / uScaleByDistance[0];

                vec3 vert = qRotate(qRot, scd * pickingScale * (aVertexPosition * aScale + aTranslate)) + scd * aLocalPosition;
                    
                gl_Position = projectionMatrix * viewMatrixRTE  * vec4(highDiff + lowDiff + vert, 1.0);
            }`,
        fragmentShader:
            `precision highp float;
            varying vec3 vColor;
            void main () {
                gl_FragColor = vec4(vColor, 1.0);
            }`
    });

export const geo_object_depth = (): Program =>
    new Program("geo_object_depth", {
        uniforms: {
            viewMatrix: "mat4",
            projectionMatrix: "mat4",
            uScaleByDistance: "vec3",
            rtcEyePositionHigh: "vec3",
            rtcEyePositionLow: "vec3",
            frustumPickingColor: "float"
        },
        attributes: {
            aVertexPosition: "vec3",
            aRTCPositionHigh: {type: "vec3", divisor: 1},
            aRTCPositionLow: {type: "vec3", divisor: 1},
            aScale: {type: "vec3", divisor: 1},
            aTranslate: {type: "vec3", divisor: 1},
            aDispose: {type: "float", divisor: 1},
            qRot: {type: "vec4", divisor: 1},
            aLocalPosition: {type: "vec3", divisor: 1},
        },
        vertexShader: `#version 300 es
            precision highp float;

            in vec3 aVertexPosition;
            in vec3 aRTCPositionHigh;
            in vec3 aRTCPositionLow;
            in vec3 aScale;
            in vec3 aTranslate;
            in float aDispose;
            in vec4 qRot;
            in vec3 aLocalPosition;
            
            uniform vec3 rtcEyePositionHigh;
            uniform vec3 rtcEyePositionLow;
            uniform vec3 uScaleByDistance;
            uniform mat4 projectionMatrix;
            uniform mat4 viewMatrix;
                      
            ${QROT}

            void main(void) {

                if (aDispose == 0.0) {
                    return;
                 }
                
                mat4 viewMatrixRTE = viewMatrix;
                viewMatrixRTE[3] = vec4(0.0, 0.0, 0.0, 1.0);
                
                vec3 highDiff = aRTCPositionHigh - rtcEyePositionHigh;
                vec3 lowDiff = aRTCPositionLow - rtcEyePositionLow;  
                
                highDiff = highDiff * step(1.0, length(highDiff));
                
                vec4 positionInViewSpace = viewMatrixRTE * vec4(highDiff + lowDiff, 1.0);

                float lookLength = length(positionInViewSpace.xyz);
                                
                float scd = uScaleByDistance[2] * clamp(lookLength, uScaleByDistance[0], uScaleByDistance[1]) / uScaleByDistance[0];

                vec3 vert = qRotate(qRot, scd * (aVertexPosition * aScale + aTranslate)) + scd * aLocalPosition;
                                                 
                gl_Position = projectionMatrix * viewMatrixRTE * vec4(highDiff + lowDiff + vert, 1.0);
            }`,
        fragmentShader:
            `#version 300 es
            precision highp float;
                        
            uniform float frustumPickingColor;
            
            layout(location = 0) out vec4 frustumColor;
            layout(location = 1) out vec4 depthColor;
                        
            void main () {
                frustumColor = vec4(frustumPickingColor, frustumPickingColor, frustumPickingColor, 1.0);
                depthColor = vec4(gl_FragCoord.z, gl_FragCoord.z, gl_FragCoord.z, 1.0);
            }`
    });