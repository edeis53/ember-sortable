import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('sortable-dragdrop-item', 'Integration | Component | sortable dragdrop item', {
  integration: true
});

test('it renders', function(assert) {
  // Set any properties with this.set('myProperty', 'value');
  // Handle any actions with this.on('myAction', function(val) { ... });

  this.render(hbs`{{sortable-dragdrop-item}}`);

  assert.equal(this.$().text().trim(), '');

  // Template block usage:
  this.render(hbs`
    {{#sortable-dragdrop-item}}
      template block text
    {{/sortable-dragdrop-item}}
  `);

  assert.equal(this.$().text().trim(), 'template block text');
});
