import {Program} from '../../webgl/Program';
import {UTILS} from "../utils";

export function polyline_screen(): Program {
    return new Program("polyline_screen", {
        uniforms: {
            viewport: "vec2",
            proj: "mat4",
            view: "mat4",
            rtcEyePositionHigh: "vec3",
            rtcEyePositionLow: "vec3",
            thickness: "float",
            opacity: "float",
            depthOffset: "float",
            visibleSphere: "vec4",
        },
        attributes: {
            prevHigh: "vec3",
            currentHigh: "vec3",
            nextHigh: "vec3",

            prevLow: "vec3",
            currentLow: "vec3",
            nextLow: "vec3",

            order: "float",

            color: "vec4"
        },

        vertexShader:
            `precision highp float;

                attribute vec3 prevHigh;
                attribute vec3 currentHigh;
                attribute vec3 nextHigh;

                attribute vec3 prevLow;
                attribute vec3 currentLow;
                attribute vec3 nextLow;

                attribute float order;

                attribute vec4 color;

                uniform float thickness;
                uniform mat4 proj;
                uniform mat4 view;
                uniform vec2 viewport;
                uniform vec3 rtcEyePositionHigh;
                uniform vec3 rtcEyePositionLow;
                uniform float opacity;
                uniform float depthOffset;
               

                varying vec4 vColor;
                varying vec3 vPos;
                varying vec3 uCamPos;

                const float NEAR = -1.0;

                vec2 getIntersection(vec2 start1, vec2 end1, vec2 start2, vec2 end2){
                    vec2 dir = end2 - start2;
                    vec2 perp = vec2(-dir.y, dir.x);
                    float d2 = dot(perp, start2);
                    float seg = dot(perp, start1) - d2;
                    float prl = seg - dot(perp, end1) + d2;
                    if(prl > -1.0 && prl < 1.0){
                        return start1;
                    }
                    float u = seg / prl;
                    return start1 + u * (end1 - start1);
                }

                vec2 project(vec4 p){
                    return (0.5 * p.xyz / p.w + 0.5).xy * viewport;
                }

                void main(){

                    uCamPos = rtcEyePositionHigh + rtcEyePositionLow;
                    vPos = currentHigh + currentLow;
                    
                    vColor = vec4(color.rgb, color.a * opacity);

                    mat4 viewMatrixRTE = view;
                    viewMatrixRTE[3] = vec4(0.0, 0.0, 0.0, 1.0);

                    vec3 highDiff, lowDiff;

                    highDiff = currentHigh - rtcEyePositionHigh;
                    highDiff = highDiff * step(1.0, length(highDiff));
                    lowDiff = currentLow - rtcEyePositionLow;                   
                    vec4 vCurrent = viewMatrixRTE * vec4(highDiff + lowDiff, 1.0);

                    highDiff = prevHigh - rtcEyePositionHigh;
                    highDiff = highDiff * step(1.0, length(highDiff));
                    lowDiff = prevLow - rtcEyePositionLow;
                    vec4 vPrev = viewMatrixRTE * vec4(highDiff + lowDiff, 1.0);

                    highDiff = nextHigh - rtcEyePositionHigh;
                    highDiff = highDiff * step(1.0, length(highDiff));
                    lowDiff = nextLow - rtcEyePositionLow;
                    vec4 vNext = viewMatrixRTE * vec4(highDiff + lowDiff, 1.0);

                    /*Clip near plane, the point behind view plane*/
                    if(vCurrent.z > NEAR) {
                        if(vPrev.z < NEAR && abs(order) == 1.0){
                            vCurrent = vPrev + (vCurrent - vPrev) * (NEAR - vPrev.z) / (vCurrent.z - vPrev.z);
                        } else if(vNext.z < NEAR && abs(order) == 2.0){
                            vCurrent = vNext + (vCurrent - vNext) * (NEAR - vNext.z) / (vCurrent.z - vNext.z);
                        }
                    }

                    vec4 dCurrent = proj * vCurrent;
                    vec2 _next = project(proj * vNext);
                    vec2 _prev = project(proj * vPrev);
                    vec2 _current = project(dCurrent);

                    if(_prev == _current){
                        if(_next == _current){
                            _next = _current + vec2(1.0, 0.0);
                            _prev = _current - _next;
                        }else{
                            _prev = _current + normalize(_current - _next);
                        }
                    }

                    if(_next == _current){
                        _next = _current + normalize(_current - _prev);
                    }

                    vec2 sNext = _next,
                         sCurrent = _current,
                         sPrev = _prev;

                    vec2 dirNext = normalize(sNext - sCurrent);
                    vec2 dirPrev = normalize(sPrev - sCurrent);
                    float dotNP = dot(dirNext, dirPrev);

                    vec2 normalNext = normalize(vec2(-dirNext.y, dirNext.x));
                    vec2 normalPrev = normalize(vec2(dirPrev.y, -dirPrev.x));

                    float d = thickness * sign(order);

                    vec2 m;
                    if(dotNP >= 0.99991){
                        m = sCurrent - normalPrev * d;
                    }else{
                        m = getIntersection( sCurrent + normalPrev * d, sPrev + normalPrev * d,
                                sCurrent + normalNext * d, sNext + normalNext * d );

                        if( dotNP > 0.5 && dot(dirNext + dirPrev, m - sCurrent) < 0.0 ){
                            float occw = order * sign(dirNext.x * dirPrev.y - dirNext.y * dirPrev.x);
                            if(occw == -1.0){
                                m = sCurrent + normalPrev * d;
                            }else if(occw == 1.0){
                                m = sCurrent + normalNext * d;
                            }else if(occw == -2.0){
                                m = sCurrent + normalNext * d;
                            }else if(occw == 2.0){
                                m = sCurrent + normalPrev * d;
                            }
                        }else if(distance(sCurrent, m) > min(distance(sCurrent, sNext), distance(sCurrent, sPrev))){
                            m = sCurrent + normalNext * d;
                        }
                    }

                    gl_Position = vec4((2.0 * m / viewport - 1.0) * dCurrent.w, dCurrent.z + depthOffset, dCurrent.w);
                }`,

        fragmentShader:
            `precision highp float;
            
                uniform vec4 visibleSphere;
                            
                varying vec3 uCamPos;
                varying vec4 vColor;
                varying vec3 vPos;               
                
                ${UTILS}
            
                void main() {
                    
                    if(visibleSphere.w != 0.0) {                  
                        vec3 cam_dir = normalize(vPos - uCamPos);
                        vec3 sph_dir = normalize(vPos - visibleSphere.xyz);
                        if( dot(cam_dir, sph_dir) > 0.11 ){
                            discard;
                        }
                   }
                   
                    gl_FragColor = vec4(vColor.rgb, vColor.a);
                }`
    });
}

export function polyline_picking(): Program {
    return new Program("polyline_picking", {
        uniforms: {
            viewport: "vec2",
            proj: "mat4",
            view: "mat4",
            rtcEyePositionHigh: "vec3",
            rtcEyePositionLow: "vec3",
            color: "vec4",
            thickness: "float",
            depthOffset: "float",
            visibleSphere: "vec4",
        },
        attributes: {
            prevHigh: "vec3",
            currentHigh: "vec3",
            nextHigh: "vec3",

            prevLow: "vec3",
            currentLow: "vec3",
            nextLow: "vec3",

            order: "float"
        },

        vertexShader:
            `precision highp float;
                
                attribute vec3 prevHigh;
                attribute vec3 currentHigh;
                attribute vec3 nextHigh;
                
                attribute vec3 prevLow;
                attribute vec3 currentLow;
                attribute vec3 nextLow;

                attribute float order;

                uniform float thickness;
                uniform vec4 color;
                uniform mat4 proj;
                uniform mat4 view;
                uniform vec2 viewport;
                uniform vec3 rtcEyePositionHigh;
                uniform vec3 rtcEyePositionLow;
                uniform float depthOffset;

                varying vec4 vColor;
                varying vec3 vPos;
                varying vec3 uCamPos;
               
                
                const float NEAR = -1.0;
                
                vec2 getIntersection(vec2 start1, vec2 end1, vec2 start2, vec2 end2){
                    vec2 dir = end2 - start2;
                    vec2 perp = vec2(-dir.y, dir.x);
                    float d2 = dot(perp, start2);
                    float seg = dot(perp, start1) - d2;
                    float prl = seg - dot(perp, end1) + d2;
                    if(prl > -1.0 && prl < 1.0){
                        return start1;
                    }
                    float u = seg / prl;
                    return start1 + u * (end1 - start1);
                }
                
                vec2 project(vec4 p){
                    return (0.5 * p.xyz / p.w + 0.5).xy * viewport;
                }
                
                void main(){

                    uCamPos = rtcEyePositionHigh + rtcEyePositionLow;
                    vPos = currentHigh + currentLow;
                    vColor = color;               

                    vec3 highDiff, lowDiff;

                    mat4 viewMatrixRTE = view;
                    viewMatrixRTE[3] = vec4(0.0, 0.0, 0.0, 1.0);
                    
                    highDiff = currentHigh - rtcEyePositionHigh;
                    highDiff = highDiff * step(1.0, length(highDiff));
                    lowDiff = currentLow - rtcEyePositionLow;
                    vec4 vCurrent = viewMatrixRTE * vec4(highDiff + lowDiff, 1.0);

                    highDiff = prevHigh - rtcEyePositionHigh;
                    highDiff = highDiff * step(1.0, length(highDiff));
                    lowDiff = prevLow - rtcEyePositionLow;    
                    vec4 vPrev = viewMatrixRTE * vec4(highDiff + lowDiff, 1.0);

                    highDiff = nextHigh - rtcEyePositionHigh;
                    highDiff = highDiff * step(1.0, length(highDiff));
                    lowDiff = nextLow - rtcEyePositionLow;    
                    vec4 vNext = viewMatrixRTE * vec4(highDiff + lowDiff, 1.0);

                    /*Clip near plane*/
                    if(vCurrent.z > NEAR) {
                        if(vPrev.z < NEAR && abs(order) == 1.0){
                            vCurrent = vPrev + (vCurrent - vPrev) * (NEAR - vPrev.z) / (vCurrent.z - vPrev.z);
                        } else if(vNext.z < NEAR && abs(order) == 2.0){
                            vCurrent = vNext + (vCurrent - vNext) * (NEAR - vNext.z) / (vCurrent.z - vNext.z);
                        }
                    }
                    
                    vec4 dCurrent = proj * vCurrent;
                    vec2 _next = project(proj * vNext);
                    vec2 _prev = project(proj * vPrev);
                    vec2 _current = project(dCurrent);
                    if(_prev == _current){
                        if(_next == _current){
                            _next = _current + vec2(1.0, 0.0);
                            _prev = _current - _next;
                        }else{
                            _prev = _current + normalize(_current - _next);
                        }
                    }
                    if(_next == _current){
                        _next = _current + normalize(_current - _prev);
                    }
                    
                    vec2 sNext = _next,
                         sCurrent = _current,
                         sPrev = _prev;

                    vec2 dirNext = normalize(sNext - sCurrent);
                    vec2 dirPrev = normalize(sPrev - sCurrent);
                    float dotNP = dot(dirNext, dirPrev);
                    
                    vec2 normalNext = normalize(vec2(-dirNext.y, dirNext.x));
                    vec2 normalPrev = normalize(vec2(dirPrev.y, -dirPrev.x));
                    
                    float d = thickness * sign(order);
                    
                    vec2 m;
                    if(dotNP >= 0.99991){
                        m = sCurrent - normalPrev * d;
                    }else{
                        m = getIntersection( sCurrent + normalPrev * d, sPrev + normalPrev * d,
                                sCurrent + normalNext * d, sNext + normalNext * d );
                        
                        if( dotNP > 0.5 && dot(dirNext + dirPrev, m - sCurrent) < 0.0 ){
                            float occw = order * sign(dirNext.x * dirPrev.y - dirNext.y * dirPrev.x);
                            if(occw == -1.0){
                                m = sCurrent + normalPrev * d;
                            }else if(occw == 1.0){
                                m = sCurrent + normalNext * d;
                            }else if(occw == -2.0){
                                m = sCurrent + normalNext * d;
                            }else if(occw == 2.0){
                                m = sCurrent + normalPrev * d;
                            }
                        }
                        else if(distance(sCurrent, m) > min(distance(sCurrent, sNext), distance(sCurrent, sPrev))){
                            m = sCurrent + normalNext * d;
                        }
                    }
                    gl_Position = vec4((2.0 * m / viewport - 1.0) * dCurrent.w, dCurrent.z + depthOffset, dCurrent.w);
                }`,

        fragmentShader:
            `precision highp float;
            
                uniform vec4 visibleSphere;
                            
                varying vec3 uCamPos;
                varying vec4 vColor;
                varying vec3 vPos;
                
                void main() {
                    if(visibleSphere.w != 0.0) {                  
                        vec3 cam_dir = normalize(vPos - uCamPos);
                        vec3 sph_dir = normalize(vPos - visibleSphere.xyz);
                        if( dot(cam_dir, sph_dir) > 0.11 ){
                            discard;
                        }
                    }                 
                    gl_FragColor = vec4(vColor.rgb, vColor.a);
                }`
    });
}