const buffer = 20;

function findRoot(code){
  // return code.split('_react.default.createElement').reduce((comp, str) => {
  //   if(str[0] === '(' && str[1] === '_'){
  //     return str.slice(2, str.indexOf('.'));
  //   }
  //   return comp;
  // }, '');
  const arr = code.split('_reactDom.default.render(_react.default.createElement(_')
  return arr[1].slice(0, arr[1].indexOf('.'));
}

function Trie(value){
  this.value = value;
  this.next = [];
}

function createTree(root, code){
  let head = new Trie(root);

  function createLeaf(current){
    let end = code.indexOf(`return ${current.value};`);
    if(end === -1){
      end = code.indexOf(`};`);
    }
    let sample = code.slice(code.indexOf(`var ${current.value} =`), end)
                .split('_react.default.createElement');

    let name = current.value;
    if(sample.length === 1){
      return;
    }

    sample.forEach((str) => {
      let value;

      if(str[0] === '(' && str[1] >= 'A' && str[1] <= 'Z'){
        value = str.slice(1, str.indexOf(','))
      }
      else if(str[0] === '(' && str[1] === '_'){
        value = str.slice(2, str.indexOf('.'));
      }

      if(value){
        current.next.push(new Trie(value));
      }
    });

    current.next.forEach((node) => {
      createLeaf(node);
    })
  }

  createLeaf(head);
  return head;
}

function dragstarted(d) {
  const cx = d3.select(this).attr("cx");
  const cy = d3.select(this).attr("cy");

  d3.select(this).raise().classed("active", true);
  d3.select(`text[x='${cx-buffer}'][y='${cy}']`).raise().classed("active", true);
}

function dragged(d) {
  const cx = d3.select(this).attr("cx");
  const cy = d3.select(this).attr("cy");

  d3.selectAll(`line[x1='${cx}'][y1='${cy}']`).attr("x1", d3.event.x).attr("y1", d3.event.y);
  d3.selectAll(`line[x2='${cx}'][y2='${cy}']`).attr("x2", d3.event.x).attr("y2", d3.event.y);
  d3.select(`text[x='${cx-buffer}'][y='${cy}']`).attr("x", d3.event.x-buffer).attr("y", d3.event.y);
  d3.select(this).attr("cx", d3.event.x).attr("cy", d3.event.y);
}


function draw(comp, cx, cy, x2, y2, level = 1){

  d3.select('svg')
    .append("line")
    .attr("x1", cx)
    .attr("y1", cy)
    .attr("x2", x2)
    .attr("y2", y2)
    .style("stroke", "DimGray")

  d3.select("svg")
    .append("circle")
    .attr("class", comp.value)
    .attr("cx", cx)
    .attr("cy", cy)
    .attr("r", 25)
    .style("fill", "#282c34")

  d3.select('svg')
    .append("text")
    .attr("x", cx - buffer)
    .attr("y", cy)
    .text(comp.value)
    .attr("font-family", "sans-serif")
    .attr("font-size", "12px")
    .attr("fill", "#61dafb");

  let newX = cx;
  const prevX = cx;

  comp.next.forEach((element) => {
    draw(element, newX, cy + 60, prevX, cy, level + 1)
    newX += (100 / level);
  })
}

function reorder(root){
  d3.select(`.${root}`)
    .style("stroke", "#61dafb")

  d3.selectAll("circle")
    .raise()
    .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged));

  d3.selectAll("text")
    .raise();
}


function start(myBlob){
  const root = findRoot(myBlob);
  const tree = createTree(root, myBlob);

  draw(tree, 25, 25, 25, 25);
  reorder(root);
}

function changeScript(myBlob){
  const str = `
  fetch('http://localhost:5000/bundle.js').then(function(response) {
    return response.text();
  }).then(function(myBlob) {
    const script = document.getElementById("mysrc");
    script.remove();

    let newScript = document.createElement("script");
    newScript.type = "text/javascript";
    newScript.setAttribute("id", "newSrc");

    const render = 'function render() {';
    const didMount = render + ' console.log("render", this.props, this.state)';
    const insert = myBlob.split(render).join(didMount);
    newScript.innerHTML = insert;

    document.body.append(newScript);
  });
  `

  chrome.devtools.inspectedWindow.eval(str, function(result, isException) {
    start(myBlob);
  });
}

function begin(){
  chrome.devtools.inspectedWindow.getResources(function(resources){
    const resource = resources.find(function(obj){
      return obj.url.includes('bundle.js')
    })

    resource.getContent(function(content, encoding){
      changeScript(content);
    });
  });
}


chrome.devtools.network.onNavigated.addListener(function(){
  setTimeout(() => { window.location.reload(true); }, 500);
})

chrome.devtools.inspectedWindow.onResourceContentCommitted.addListener(function(resource, content){
  window.alert("change");
})

begin();
