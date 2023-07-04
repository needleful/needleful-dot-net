var burgerClicked = function() {
	console.log('you have clicked the burger button');
	var button = document.getElementById('burger-button');
	var block = document.getElementById('burger-block');
	if(button.className === 'clicked') {
		button.className = 'not-clicked';
		block.className = 'noshow';
	}
	else{
		button.className='clicked';
		block.className = 'show';
	}
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