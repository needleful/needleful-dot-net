const table = {rows:0, columns:0};
const mt = document.getElementById("main-table");
var scripts = {};


function $(row, column) {
	var element = document.getElementById("r"+row+"c"+column);
	if (!element || element.value === null) {
		console.log("No element found at " + row + ", " + column);
		return null;
	}
	else {
		let str = element.value;
		if(isNumeric(str)) {
			return parseFloat(str);
		}
		else {
			return str;
		}
	}
}

// Stolen from Stack Overflow
function isNumeric(str) {
	if (typeof str != "string") return false;
	return !isNaN(str) && !isNaN(parseFloat(str));
}

function makeChild(parent, tag, attributes) {
	let item = document.createElement(tag);
	parent.appendChild(item);
	if (attributes) {
		Object.keys(attributes).map(function(key) {
			item.setAttribute(key, attributes[key]);
		});
	}
	return item;
}

function onTableInputFocus(id) {
	return function() {
		if (id in scripts){
			document.getElementById(id).value = scripts[id];
		}
	}
}

function onTableInputFocusOut(id) {
	return function() {
		let elem = document.getElementById(id);
		let text = elem.value;
		if(text.startsWith("{") && text.endsWith("}")) {
			scripts[id] = text;
			elem.value = eval(text.slice(1, -1));
		}
		else if(id in scripts) {
			delete scripts[id];
		}
	}
}

function createTable() {
	createTableFromSize(document.getElementById("rows").value, document.getElementById("columns").value);
}

function createTableFromSize(rows, columns) {
	table.rows = rows;
	table.columns = columns;
	scripts = {};
	console.log("Creating Table: " + table.rows + " by " + table.columns);
	while(mt.firstChild) {
		mt.removeChild(mt.firstChild);
	}

	let trows = table.rows;
	let tcol = table.columns;

	let header = makeChild(mt, "thead", {id:"table-header"});
	let body = makeChild(mt, "tbody");

	let headerRow = makeChild(header, "tr");
	makeChild(headerRow, "th").innerText = "Rows";

	for (let hc = 0; hc < tcol; hc++) {
		let child = makeChild(headerRow, "th", {id:"th"+hc});
		child.innerText = hc + 1;
	}

	for(let r = 0; r < trows; r++) {
		let row = makeChild(body, "tr");
		let rowLabel = makeChild(row, "td");
		rowLabel.innerText = r + 1;
		for(let c = 0; c < tcol; c++) {
			let data = makeChild(row, "td");
			let node_id = "r"+(r+1)+"c"+(c+1);
			let input = makeChild(data, "input", {type:"text", id:node_id});
			input.addEventListener("focus", onTableInputFocus(node_id));
			input.addEventListener("focusout", onTableInputFocusOut(node_id));
		}
	}
}

function getTableData(results) {
	let data = "";
	for (let r = 1; r <= table.rows; r++) {
		for(let c = 1; c <= table.columns; c++) {
			let id = "r"+r+"c"+c;
			if (!results && id in scripts) {
				data += scripts[id];
			}
			else {
				data += $(r, c);
			}

			if(c < table.columns) {
				data += "\t";
			}
		}
		if(r < table.rows) {
			data += "\n";
		}
	}
	return data;
}

function exportTable() {
	console.log('Exporting table');
	let filename = 'table.tsv';
	let results = document.getElementById('export-results').checked;
	const blob = new Blob([getTableData(results)], {type: 'text/plain'});
	if(window.navigator.msSaveOrOpenBlob) {
		window.navigator.msSaveBlob(blob, filename);
	}
	else{
		const elem = window.document.createElement('a');
		elem.href = window.URL.createObjectURL(blob);
		elem.download = filename;        
		document.body.appendChild(elem);
		elem.click();
		document.body.removeChild(elem);
    }
}

function importTable() {
	const files = document.getElementById('tsv-import').files;
	if(files.length != 1) {
		console.log('One (and only one) file required!');
		return;
	}
	const file = files[0];
	console.log("Importing "+file.name);

	let reader = new FileReader();
	reader.readAsText(file);
	reader.onload = function() {
		loadText(reader.result);
	}
}

function loadText(text) {
	let data = [];
	let rows = 0;
	let columns = 0;
	let split_lines = text.split('\n');
	rows = split_lines.length;

	split_lines.map(function(line) {
		let tab_split = line.split('\t');
		if (tab_split.length > columns) {
			columns = tab_split.length;
		}
		data.push(tab_split);
	});
	
	createTableFromSize(rows, columns);

	for(let r = 1; r <= rows; r++) {
		for(let c = 1; c <= columns; c++) {
			let text = data[r-1][c-1];
			let id = 'r'+r+'c'+c;
			document.getElementById(id).value = text;
		}
	}

}

document.getElementById('tsv-import').addEventListener('change', importTable);