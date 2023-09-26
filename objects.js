"use strict";

// Esta função analisa um arquivo .obj e extrai os dados necessários para renderização.
function parseOBJ(text) {
  // Inicializa arrays para armazenar dados do objeto.
  // Os dados incluem posições, coordenadas de textura, normais e cores.
  const objPositions = [[0, 0, 0]];
  const objTexcoords = [[0, 0]];
  const objNormals = [[0, 0, 0]];
  const objColors = [[0, 0, 0]];

  // Arrays para armazenar os dados em ordem específica para renderização WebGL.
  const objVertexData = [
    objPositions,
    objTexcoords,
    objNormals,
    objColors,
  ];

  // Arrays para armazenar os dados WebGL finais.
  let webglVertexData = [
    [],   // positions
    [],   // texcoords
    [],   // normals
    [],   // colors
  ];

  // Lista de materiais e geometrias do arquivo .obj.
  const materialLibs = [];
  const geometries = [];
  let geometry;
  let groups = ['default'];
  let material = 'default';
  let object = 'default';

  const noop = () => { };

  // Função auxiliar para criar uma nova geometria.
  function newGeometry() {
    // Se houver uma geometria existente e ela não estiver vazia, inicie uma nova.
    if (geometry && geometry.data.position.length) {
      geometry = undefined;
    }
  }

  // Função auxiliar para configurar a geometria atual.
  function setGeometry() {
    if (!geometry) {
      const position = [];
      const texcoord = [];
      const normal = [];
      const color = [];
      webglVertexData = [
        position,
        texcoord,
        normal,
        color,
      ];
      geometry = {
        object,
        groups,
        material,
        data: {
          position,
          texcoord,
          normal,
          color,
        },
      };
      geometries.push(geometry);
    }
  }

  // Função auxiliar para adicionar vértices à geometria atual.
  function addVertex(vert) {
    const ptn = vert.split('/');
    ptn.forEach((objIndexStr, i) => {
      if (!objIndexStr) {
        return;
      }
      const objIndex = parseInt(objIndexStr);
      const index = objIndex + (objIndex >= 0 ? 0 : objVertexData[i].length);
      webglVertexData[i].push(...objVertexData[i][index]);
      // Se este for o índice de posição (índice 0) e já analisamos cores de vértices,
      // copie as cores de vértices para os dados de cores de vértices WebGL.
      if (i === 0 && objColors.length > 1) {
        geometry.data.color.push(...objColors[index]);
      }
    });
  }

  // Dicionário de palavras-chave no arquivo .obj e suas funções de manipulação.
  const keywords = {
    v(parts) {
      // Se houver mais de 3 valores aqui, eles são cores de vértices.
      if (parts.length > 3) {
        objPositions.push(parts.slice(0, 3).map(parseFloat));
        objColors.push(parts.slice(3).map(parseFloat));
      } else {
        objPositions.push(parts.map(parseFloat));
      }
    },
    vn(parts) {
      objNormals.push(parts.map(parseFloat));
    },
    vt(parts) {
      // should check for missing v and extra w?
      objTexcoords.push(parts.map(parseFloat));
    },
    f(parts) {
      setGeometry();
      const numTriangles = parts.length - 2;
      for (let tri = 0; tri < numTriangles; ++tri) {
        addVertex(parts[0]);
        addVertex(parts[tri + 1]);
        addVertex(parts[tri + 2]);
      }
    },
    s: noop,    // smoothing group
    mtllib(parts, unparsedArgs) {
      // O formato permite vários nomes de arquivos MTL aqui, mas muitos têm espaços em um único nome de arquivo.
      materialLibs.push(unparsedArgs);
    },
    usemtl(parts, unparsedArgs) {
      material = unparsedArgs;
      newGeometry();
    },
    g(parts) {
      groups = parts;
      newGeometry();
    },
    o(parts, unparsedArgs) {
      object = unparsedArgs;
      newGeometry();
    },
  };

  // Expressão regular para analisar cada linha do arquivo .obj.
  const keywordRE = /(\w*)(?: )*(.*)/;
  const lines = text.split('\n');
  for (let lineNo = 0; lineNo < lines.length; ++lineNo) {
    const line = lines[lineNo].trim();
    if (line === '' || line.startsWith('#')) {
      continue;
    }
    const m = keywordRE.exec(line);
    if (!m) {
      continue;
    }
    const [, keyword, unparsedArgs] = m;
    const parts = line.split(/\s+/).slice(1);
    const handler = keywords[keyword];
    if (!handler) {
      console.warn('unhandled keyword:', keyword);  // Avisa no console se uma palavra-chave não é tratada.
      continue;
    }
    handler(parts, unparsedArgs);
  }

  // Remove quaisquer arrays que não tenham entradas.
  for (const geometry of geometries) {
    geometry.data = Object.fromEntries(
      Object.entries(geometry.data).filter(([, array]) => array.length > 0));
  }

  return {
    geometries,
    materialLibs,
  };
}

// Função para analisar argumentos de mapeamento de textura do arquivo .mtl.
function parseMapArgs(unparsedArgs) {
  // TODO: handle options
  return unparsedArgs;
}
// Função para analisar um arquivo .mtl e extrair informações de material.
function parseMTL(text) {
  const materials = {};
  let material;

  // Dicionário de palavras-chave no arquivo .mtl e suas funções de manipulação.
  const keywords = {
    newmtl(parts, unparsedArgs) {
      material = {};
      materials[unparsedArgs] = material;
    },
    /* eslint brace-style:0 */
    Ns(parts) { material.shininess = parseFloat(parts[0]); },
    Ka(parts) { material.ambient = parts.map(parseFloat); },
    Kd(parts) { material.diffuse = parts.map(parseFloat); },
    Ks(parts) { material.specular = parts.map(parseFloat); },
    Ke(parts) { material.emissive = parts.map(parseFloat); },
    map_Kd(parts, unparsedArgs) { material.diffuseMap = parseMapArgs(unparsedArgs); },
    map_Ns(parts, unparsedArgs) { material.specularMap = parseMapArgs(unparsedArgs); },
    map_Bump(parts, unparsedArgs) { material.normalMap = parseMapArgs(unparsedArgs); },
    Ni(parts) { material.opticalDensity = parseFloat(parts[0]); },
    d(parts) { material.opacity = parseFloat(parts[0]); },
    illum(parts) { material.illum = parseInt(parts[0]); },
  };

  // Expressão regular para analisar cada linha do arquivo .mtl.
  const keywordRE = /(\w*)(?: )*(.*)/;
  const lines = text.split('\n');
  for (let lineNo = 0; lineNo < lines.length; ++lineNo) {
    const line = lines[lineNo].trim();
    if (line === '' || line.startsWith('#')) {
      continue;
    }
    const m = keywordRE.exec(line);
    if (!m) {
      continue;
    }
    const [, keyword, unparsedArgs] = m;
    const parts = line.split(/\s+/).slice(1);
    const handler = keywords[keyword];
    if (!handler) {
      console.warn('unhandled keyword:', keyword);  // Avisa no console se uma palavra-chave não é tratada.
      continue;
    }
    handler(parts, unparsedArgs);
  }

  return materials;
}

// Função para verificar se um número é uma potência de 2.
function isPowerOf2(value) {
  return (value & (value - 1)) === 0;
}

// Função para criar uma textura de 1 pixel.
function create1PixelTexture(gl, pixel) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
    new Uint8Array(pixel));
  return texture;
}

// Função para criar uma textura a partir de uma URL.
function createTexture(gl, url) {
  const texture = create1PixelTexture(gl, [128, 192, 255, 255]);
  // Carrega uma imagem de forma assíncrona.
  const image = new Image();
  image.src = url;
  image.addEventListener('load', function () {
    // Agora que a imagem foi carregada, copie-a para a textura.
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    // Verifica se a imagem é uma potência de 2 em ambas as dimensões.
    if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
      // Sim, é uma potência de 2. Gere mips.
      gl.generateMipmap(gl.TEXTURE_2D);
    } else {
      // Não é uma potência de 2. Desative os mipmaps e configure o envolvimento para CLAMP_TO_EDGE.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
  });
  return texture;
}

// Função para criar um iterador de índice com base em uma lista de índices.
function makeIndexIterator(indices) {
  let ndx = 0;
  const fn = () => indices[ndx++];
  fn.reset = () => { ndx = 0; };
  fn.numElements = indices.length;
  return fn;
}

// Função para criar um iterador não indexado com base em posições.
function makeUnindexedIterator(positions) {
  let ndx = 0;
  const fn = () => ndx++;
  fn.reset = () => { ndx = 0; };
  fn.numElements = positions.length / 3;
  return fn;
}

// Função para subtrair dois vetores 2D.
const subtractVector2 = (a, b) => a.map((v, ndx) => v - b[ndx]);

// Função para gerar tangentes para os vértices.
function generateTangents(position, texcoord, indices) {
  const getNextIndex = indices ? makeIndexIterator(indices) : makeUnindexedIterator(position);
  const numFaceVerts = getNextIndex.numElements;
  const numFaces = numFaceVerts / 3;

  const tangents = [];
  for (let i = 0; i < numFaces; ++i) {
    const n1 = getNextIndex();
    const n2 = getNextIndex();
    const n3 = getNextIndex();

    const p1 = position.slice(n1 * 3, n1 * 3 + 3);
    const p2 = position.slice(n2 * 3, n2 * 3 + 3);
    const p3 = position.slice(n3 * 3, n3 * 3 + 3);

    const uv1 = texcoord.slice(n1 * 2, n1 * 2 + 2);
    const uv2 = texcoord.slice(n2 * 2, n2 * 2 + 2);
    const uv3 = texcoord.slice(n3 * 2, n3 * 2 + 2);

    const dp12 = m4.subtractVectors(p2, p1);
    const dp13 = m4.subtractVectors(p3, p1);

    const duv12 = subtractVector2(uv2, uv1);
    const duv13 = subtractVector2(uv3, uv1);

    const f = 1.0 / (duv12[0] * duv13[1] - duv13[0] * duv12[1]);
    const tangent = Number.isFinite(f)
      ? m4.normalize(m4.scaleVector(m4.subtractVectors(
        m4.scaleVector(dp12, duv13[1]),
        m4.scaleVector(dp13, duv12[1]),
      ), f))
      : [1, 0, 0];

    tangents.push(...tangent, ...tangent, ...tangent);
  }

  return tangents;
}

// Função principal assíncrona que carrega objetos 3D e renderiza em um contexto WebGL.
async function main() {
  // Obtém o contexto WebGL de um elemento HTML canvas.
  /** @type {HTMLCanvasElement} */
  const canvas = document.querySelector("#canvas");
  const gl = canvas.getContext("webgl");
  if (!gl) {
    return;
  }

  // Vertex shader (vs) e fragment shader (fs).
  const vs = `
  attribute vec4 a_position;
  attribute vec3 a_normal;
  attribute vec3 a_tangent;
  attribute vec2 a_texcoord;
  attribute vec4 a_color;

  uniform mat4 u_projection;
  uniform mat4 u_view;
  uniform mat4 u_world;
  uniform vec3 u_viewWorldPosition;

  varying vec3 v_normal;
  varying vec3 v_tangent;
  varying vec3 v_surfaceToView;
  varying vec2 v_texcoord;
  varying vec4 v_color;

  void main() {
    vec4 worldPosition = u_world * a_position;
    gl_Position = u_projection * u_view * worldPosition;
    v_surfaceToView = u_viewWorldPosition - worldPosition.xyz;
    mat3 normalMat = mat3(u_world);
    v_normal = normalize(normalMat * a_normal);
    v_tangent = normalize(normalMat * a_tangent);

    v_texcoord = a_texcoord;
    v_color = a_color;
  }
  `;

  const fs = `
  precision highp float;

  varying vec3 v_normal;
  varying vec3 v_tangent;
  varying vec3 v_surfaceToView;
  varying vec2 v_texcoord;
  varying vec4 v_color;

  uniform vec3 diffuse;
  uniform sampler2D diffuseMap;
  uniform vec3 ambient;
  uniform vec3 emissive;
  uniform vec3 specular;
  uniform sampler2D specularMap;
  uniform float shininess;
  uniform sampler2D normalMap;
  uniform float opacity;
  uniform vec3 u_lightDirection;
  uniform vec3 u_ambientLight;

  void main () {
    vec3 normal = normalize(v_normal) * ( float( gl_FrontFacing ) * 2.0 - 1.0 );
    vec3 tangent = normalize(v_tangent) * ( float( gl_FrontFacing ) * 2.0 - 1.0 );
    vec3 bitangent = normalize(cross(normal, tangent));

    mat3 tbn = mat3(tangent, bitangent, normal);
    normal = texture2D(normalMap, v_texcoord).rgb * 2. - 1.;
    normal = normalize(tbn * normal);

    vec3 surfaceToViewDirection = normalize(v_surfaceToView);
    vec3 halfVector = normalize(u_lightDirection + surfaceToViewDirection);

    float fakeLight = dot(u_lightDirection, normal) * .5 + .5;
    float specularLight = clamp(dot(normal, halfVector), 0.0, 1.0);
    vec4 specularMapColor = texture2D(specularMap, v_texcoord);
    vec3 effectiveSpecular = specular * specularMapColor.rgb;

    vec4 diffuseMapColor = texture2D(diffuseMap, v_texcoord);
    vec3 effectiveDiffuse = diffuse * diffuseMapColor.rgb * v_color.rgb;
    float effectiveOpacity = opacity * diffuseMapColor.a * v_color.a;

    gl_FragColor = vec4(
        emissive +
        ambient * u_ambientLight +
        effectiveDiffuse * fakeLight +
        effectiveSpecular * pow(specularLight, shininess),
        effectiveOpacity);
  }
  `;

  // Compila e vincula os shaders, procurando atributos e uniformes.
  const meshProgramInfo = webglUtils.createProgramInfo(gl, [vs, fs]);

  // URL do arquivo .obj a ser carregado.
  const objHref = './objects/jet/jet.obj';
  const response = await fetch(objHref);
  const text = await response.text();

  // Função parseOBJ para analisar o arquivo .obj.
  const obj = parseOBJ(text);
  // URL base para carregar texturas e materiais.
  const baseHref = new URL(objHref, window.location.href);
  // Carrega texturas dos materiais.
  const matTexts = await Promise.all(obj.materialLibs.map(async filename => {
    const matHref = new URL(filename, baseHref).href;
    const response = await fetch(matHref);
    return await response.text();
  }));

  // Função parseMTL para analisar o arquivo .mtl com informações de materiais.
  const materials = parseMTL(matTexts.join('\n'));
  // Dicionário de texturas.
  const textures = {
    defaultWhite: create1PixelTexture(gl, [255, 255, 255, 255]),
    defaultNormal: create1PixelTexture(gl, [127, 127, 255, 0]),
  };

  // Carrega as texturas dos materiais e as associa aos materiais.
  for (const material of Object.values(materials)) {
    Object.entries(material)
      .filter(([key]) => key.endsWith('Map'))
      .forEach(([key, filename]) => {
        let texture = textures[filename];
        if (!texture) {
          const textureHref = new URL(filename, baseHref).href;
          texture = createTexture(gl, textureHref);
          textures[filename] = texture;
        }
        material[key] = texture;
      });
  }

  // hack the materials so we can see the specular map
  Object.values(materials).forEach(m => {
    m.shininess = 5;
    m.specular = [1, 1, 1];
  });

  // Define configurações padrão para materiais sem texturas.
  const defaultMaterial = {
    diffuse: [1, 1, 1],
    diffuseMap: textures.defaultWhite,
    normalMap: textures.defaultNormal,
    ambient: [1, 1, 1],
    specular: [1, 1, 1],
    specularMap: textures.defaultWhite,
    shininess: 20,
    opacity: 1,
  };

  // Lista de peças do objeto 3D.
  const parts = obj.geometries.map(({ material, data }) => {
    // Because data is just named arrays like this
    //
    // {
    //   position: [...],
    //   texcoord: [...],
    //   normal: [...],
    // }
    //
    // and because those names match the attributes in our vertex
    // shader we can pass it directly into `createBufferInfoFromArrays`
    // from the article "less code more fun".

    if (data.color) {
      if (data.position.length === data.color.length) {
        // it's 3. The our helper library assumes 4 so we need
        // to tell it there are only 3.
        data.color = { numComponents: 3, data: data.color };
      }
    } else {
      // there are no vertex colors so just use constant white
      data.color = { value: [1, 1, 1, 1] };
    }

    // Gere tangentes se os dados necessários estiverem presentes.
    if (data.texcoord && data.normal) {
      data.tangent = generateTangents(data.position, data.texcoord);
    } else {
      // Não há tangentes disponíveis.
      data.tangent = { value: [1, 0, 0] };
    }

    if (!data.texcoord) {
      data.texcoord = { value: [0, 0] };
    }

    if (!data.normal) {
      // Provavelmente é necessário gerar normais se não houver.
      data.normal = { value: [0, 0, 1] };
    }

    // Crie um buffer para cada conjunto de dados.
    const bufferInfo = webglUtils.createBufferInfoFromArrays(gl, data);
    return {
      material: {
        ...defaultMaterial,
        ...materials[material],
      },
      bufferInfo,
    };
  });

  // Configura zNear e zFar com base no tamanho do objeto 3D.
  const zNear = 0.001;
  const zFar = 2000;

  // Função para converter graus em radianos.
  function degToRad(deg) {
    return deg * Math.PI / 180;
  }

  // Função para renderizar o objeto 3D no canvas WebGL.
  function render(time) {
    time *= 0.001;

    const objMovement = [
      [10, -30 * Math.cos(time * 0.5), 100],
      [-50, 0, -90 * Math.cos(time * 0.5)],
      [500 * Math.cos(time * 0.5), 50, -400],
      [300 * Math.cos(time * 0.5), -70, -600],
      [10 * Math.cos(time / 2 * 0.5), 50, -140 * Math.cos(time * 0.5)],
      [-80 * Math.cos(time * 0.5), -50, -500],
    ]

    webglUtils.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.enable(gl.DEPTH_TEST);

    const fieldOfViewRadians = degToRad(60);
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const projection = m4.perspective(fieldOfViewRadians, aspect, zNear, zFar);

    const sharedUniforms = {
      u_lightDirection: m4.normalize([-1, 3, 5]),
      u_projection: projection,
    };
    
    var i = 0;
    // Aplicar transformações e renderizar cada instância do objeto 3D.
    for (const obj of objs) {
      if (obj.visible) {

        const position = obj.position;
        const world = m4.identity();
        world[12] = objectPositions[i][0] + objMovement[i][0];
        world[13] = objectPositions[i][1] + objMovement[i][1];
        world[14] = objectPositions[i][2] + objMovement[i][2];


        obj.position = [world[12], world[13], world[14]]
        const u_world = m4.scale(world, 0.20, 0.20, 0.20)
        // Render each instance
        gl.useProgram(meshProgramInfo.program);
        webglUtils.setUniforms(meshProgramInfo, {
          u_world: u_world,   // A matriz de mundo permanece inalterada
          u_view: view,     // Aplicamos a transformação da câmera aqui
        });

        for (const { bufferInfo, material } of parts) {
          webglUtils.setBuffersAndAttributes(gl, meshProgramInfo, bufferInfo);
          webglUtils.setUniforms(meshProgramInfo, sharedUniforms, material);
          webglUtils.drawBufferInfo(gl, bufferInfo);
        }
      }
      i++;
    }

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

}

main();