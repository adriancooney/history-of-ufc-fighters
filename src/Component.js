export default class Component {
    constructor(props = {}) {
        this.props = props;
    }

    setState(state) {
        this.state = Object.assign({}, this.state, state);

        if(!this.__batching) {
            this.render();
        }
    }

    batch(callback) {
        this.__batching = true;
        callback.call(this);
        this.__batching = false;
        this.render();
    }
}