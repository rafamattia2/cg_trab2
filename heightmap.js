'use strict';

/* global twgl, m4, requestAnimationFrame, document */

const img = new Image();
img.onload = run;
img.crossOrigin = 'anonymous';
img.src = './heightmap/heightmap192x192.png';


function run() {
  // use a canvas 2D to read the image
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.canvas.width = img.width;
  ctx.canvas.height = img.height;
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  
  
  function getHeight(offset) {
    const v =  imgData.data[offset * 4]; // x4 because RGBA
    return v * 80 / 255; // 0 to 10
  }

  // first generate a grid of triangles, at least 2 or 4 for each cell
  // 
  //    2          4
  // +----+     +----+ 
  // |   /|     |\  /|
  // |  / |     | \/ |
  // | /  |     | /\ |
  // |/   |     |/  \|
  // +----+     +----+ 
  //

  const positions = [];
  const texcoords = [];
  const indices = [];

  const cellsAcross = imgData.width - 1;
  const cellsDeep = imgData.height - 1;
  for (let z = 0; z < cellsDeep; ++z) {
    for (let x = 0; x < cellsAcross; ++x) {
      const base0 = z * imgData.width + x;
      const base1 = base0 + imgData.width;

      const h00 = getHeight(base0);       const h01 = getHeight(base0 + 1);
      const h10 = getHeight(base1);
      const h11 = getHeight(base1 + 1);
      const hm = (h00 + h01 + h10 + h11) / 4;

      const x0 = x;
      const x1 = x + 1;
      const z0 = z;
      const z1 = z + 1;

      const ndx = positions.length / 3;
      positions.push(
        x0, h00, z0,
        x1, h01, z0,
        x0, h10, z1,
        x1, h11, z1,
        (x0 + x1) / 2, hm, (z0 + z1) / 2,
      );
      const u0 = x / cellsAcross;
      const v0 = z / cellsDeep;
      const u1 = (x + 1) / cellsAcross;
      const v1 = (z + 1) / cellsDeep;
      texcoords.push(
        u0, v0,
        u1, v0,
        u0, v1,
        u1, v1,
        (u0 + u1) / 2, (v0 + v1) / 2,
      );

  //         
  //      0----1 
  //      |\  /|
  //      | \/4|
  //      | /\ |
  //      |/  \|
  //      2----3 

      indices.push(
        ndx, ndx + 4, ndx + 1,
        ndx, ndx + 2, ndx + 4,
        ndx + 2, ndx + 3, ndx + 4,
        ndx + 1, ndx + 4, ndx + 3,
      );
    }
  }

  const maxAngle = 100 * Math.PI / 180;  // make them facetted
  const arrays = generateNormals({
    position: positions,
    texcoord: texcoords,
    indices,
  }, maxAngle);


  const gl = document.querySelector('canvas').getContext('webgl');

  const vs = `
  attribute vec4 position;
  attribute vec3 normal;
  attribute vec2 texcoord;

  uniform mat4 projection;
  uniform mat4 modelView;

  varying vec3 v_normal;
  varying vec2 v_texcoord;

  void main() {
    gl_Position = projection * modelView * position;
    v_normal = mat3(modelView) * normal;
    v_texcoord = texcoord;
  }
  `;

  const fs = `
    precision highp float;

    varying vec3 v_normal;
    varying vec2 v_texcoord;

    uniform sampler2D u_texture; // Uniform para a textura

    void main() {
      vec3 lightDirection = normalize(vec3(1, 2, -3));  // Direção de luz arbitrária

      float l = dot(lightDirection, normalize(v_normal)) * 0.5 + 0.5;
      vec4 textureColor = texture2D(u_texture, v_texcoord); // Amostragem da textura

      gl_FragColor = vec4(textureColor.rgb * l, textureColor.a);
    }
  `;

  const texture = twgl.createTexture(gl, {
    src: './heightmap/texture-diffuse.png',
    crossOrigin: '',
  });

  // compile shader, link, look up locations
  const programInfo = twgl.createProgramInfo(gl, [vs, fs]);

  // make some vertex data
  // calls gl.createBuffer, gl.bindBuffer, gl.bufferData for each array
  const bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);

  function render(time) {
    time *= 0.01;  // seconds

    twgl.resizeCanvasToDisplaySize(gl.canvas);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);

    const fov = Math.PI * 0.25;
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const near = 0.1;
    const far = 10000;
    const projection = m4.perspective(fov, aspect, near, far);

    let modelView = m4.yRotate(view, 0);
    modelView = m4.translate(modelView, imgData.width / -2, 0, imgData.height / -2)

    gl.useProgram(programInfo.program);

    // calls gl.bindBuffer, gl.enableVertexAttribArray, gl.vertexAttribPointer
    twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);

    // calls gl.activeTexture, gl.bindTexture, gl.uniformXXX
    twgl.setUniforms(programInfo, {
      projection,
      modelView,
      u_texture: texture,
    });  
    
    // calls gl.drawArrays or gl.drawElements
    twgl.drawBufferInfo(gl, bufferInfo);

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);


  function generateNormals(arrays, maxAngle) {
    const positions = arrays.position;
    const texcoords = arrays.texcoord;

    // first compute the normal of each face
    let getNextIndex = makeIndiceIterator(arrays);
    const numFaceVerts = getNextIndex.numElements;
    const numVerts = arrays.position.length;
    const numFaces = numFaceVerts / 3;
    const faceNormals = [];

    // Compute the normal for every face.
    // While doing that, create a new vertex for every face vertex
    for (let i = 0; i < numFaces; ++i) {
      const n1 = getNextIndex() * 3;
      const n2 = getNextIndex() * 3;
      const n3 = getNextIndex() * 3;

      const v1 = positions.slice(n1, n1 + 3);
      const v2 = positions.slice(n2, n2 + 3);
      const v3 = positions.slice(n3, n3 + 3);

      faceNormals.push(m4.normalize(m4.cross(m4.subtractVectors(v1, v2), m4.subtractVectors(v3, v2))));
    }

    let tempVerts = {};
    let tempVertNdx = 0;

    // this assumes vertex positions are an exact match

    function getVertIndex(x, y, z) {

      const vertId = x + "," + y + "," + z;
      const ndx = tempVerts[vertId];
      if (ndx !== undefined) {
        return ndx;
      }
      const newNdx = tempVertNdx++;
      tempVerts[vertId] = newNdx;
      return newNdx;
    }

    // We need to figure out the shared vertices.
    // It's not as simple as looking at the faces (triangles)
    // because for example if we have a standard cylinder
    //
    //
    //      3-4
    //     /   \
    //    2     5   Looking down a cylinder starting at S
    //    |     |   and going around to E, E and S are not
    //    1     6   the same vertex in the data we have
    //     \   /    as they don't share UV coords.
    //      S/E
    //
    // the vertices at the start and end do not share vertices
    // since they have different UVs but if you don't consider
    // them to share vertices they will get the wrong normals

    const vertIndices = [];
    for (let i = 0; i < numVerts; ++i) {
      const offset = i * 3;
      const vert = positions.slice(offset, offset + 3);
      vertIndices.push(getVertIndex(vert));
    }

    // go through every vertex and record which faces it's on
    const vertFaces = [];
    getNextIndex.reset();
    for (let i = 0; i < numFaces; ++i) {
      for (let j = 0; j < 3; ++j) {
        const ndx = getNextIndex();
        const sharedNdx = vertIndices[ndx];
        let faces = vertFaces[sharedNdx];
        if (!faces) {
          faces = [];
          vertFaces[sharedNdx] = faces;
        }
        faces.push(i);
      }
    }

    // now go through every face and compute the normals for each
    // vertex of the face. Only include faces that aren't more than
    // maxAngle different. Add the result to arrays of newPositions,
    // newTexcoords and newNormals, discarding any vertices that
    // are the same.
    tempVerts = {};
    tempVertNdx = 0;
    const newPositions = [];
    const newTexcoords = [];
    const newNormals = [];

    function getNewVertIndex(x, y, z, nx, ny, nz, u, v) {
      const vertId =
          x + "," + y + "," + z + "," +
          nx + "," + ny + "," + nz + "," +
          u + "," + v;

      const ndx = tempVerts[vertId];
      if (ndx !== undefined) {
        return ndx;
      }
      const newNdx = tempVertNdx++;
      tempVerts[vertId] = newNdx;
      newPositions.push(x, y, z);
      newNormals.push(nx, ny, nz);
      newTexcoords.push(u, v);
      return newNdx;
    }

    const newVertIndices = [];
    getNextIndex.reset();
    const maxAngleCos = Math.cos(maxAngle);
    // for each face
    for (let i = 0; i < numFaces; ++i) {
      // get the normal for this face
      const thisFaceNormal = faceNormals[i];
      // for each vertex on the face
      for (let j = 0; j < 3; ++j) {
        const ndx = getNextIndex();
        const sharedNdx = vertIndices[ndx];
        const faces = vertFaces[sharedNdx];
        const norm = [0, 0, 0];
        faces.forEach(faceNdx => {
          // is this face facing the same way
          const otherFaceNormal = faceNormals[faceNdx];
          const dot = m4.dot(thisFaceNormal, otherFaceNormal);
          if (dot > maxAngleCos) {
            m4.addVectors(norm, otherFaceNormal, norm);
          }
        });
        m4.normalize(norm, norm);
        const poffset = ndx * 3;
        const toffset = ndx * 2;
        newVertIndices.push(getNewVertIndex(
            positions[poffset + 0], positions[poffset + 1], positions[poffset + 2],
            norm[0], norm[1], norm[2],
            texcoords[toffset + 0], texcoords[toffset + 1]));
      }
    }

    return {
      position: newPositions,
      texcoord: newTexcoords,
      normal: newNormals,
      indices: newVertIndices,
    };

  }

  function makeIndexedIndicesFn(arrays) {
    const indices = arrays.indices;
    let ndx = 0;
    const fn = function() {
      return indices[ndx++];
    };
    fn.reset = function() {
      ndx = 0;
    };
    fn.numElements = indices.length;
    return fn;
  }

  function makeUnindexedIndicesFn(arrays) {
    let ndx = 0;
    const fn = function() {
      return ndx++;
    };
    fn.reset = function() {
      ndx = 0;
    }
    fn.numElements = arrays.positions.length / 3;
    return fn;
  }

  function makeIndiceIterator(arrays) {
    return arrays.indices
        ? makeIndexedIndicesFn(arrays)
        : makeUnindexedIndicesFn(arrays);
  }
}


