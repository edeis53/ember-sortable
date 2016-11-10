import Ember from 'ember';

//https://github.com/mharris717/ember-drag-drop

export default Ember.Service.extend({
    sortComponents: {}, // Contains a list of Components arranged by sortingScope. Items belonging to the same sorting scope can drag and drop between each other.

    activeDropGroup: null, //which sort group is the user trying to drop the sortItem into?

    currentDragItem: null,

    swapGroups: false, //don't need to swap groups

    //when a sorting group is created, store it's scope and all components that belong to that scope
    pushSortComponent(component) {
      const sortingScope = component.get('sortingScope');
      if (!this.get('sortComponents')[sortingScope]) {
        this.get('sortComponents')[sortingScope] = Ember.A();
      }
      this.get('sortComponents')[sortingScope].pushObject(component);
    },

    //when a sorting group is destroyed, remove it.
    removeSortComponent(component) {
      const sortingScope = component.get('sortingScope');
      this.get('sortComponents')[sortingScope].removeObject(component);
    },

    coordinate(){
      //if there is an active drop group, otherwise the object is hovering over something we can't drop into.
      if(this.activeDropGroup)
      {
          let scopeDraggedGroup = this.currentDragItem.get('group');
          let scopeActiveDropGroup = this.activeDropGroup;

          //check if we can drag this item between group we are hovering over
          if(scopeDraggedGroup.get('sortingScope') === scopeActiveDropGroup.get('sortingScope')){
            //true, we are within the same scope.

            //now do we need to coordinate anything? does the group the draggedItem belong to differ from the activeDropGroup?
            if(scopeDraggedGroup.get('elementId') !== scopeActiveDropGroup.get('elementId'))
            {
              //we are trying to drop into a new group
              this.swapGroups = true;
            }
          }
      }
    },

    dragEvent(event) {
      let position = this.getXY(event);
      //http://stackoverflow.com/questions/3918842/how-to-find-out-the-actual-event-target-of-touchmove-javascript-event
      //let realTarget = document.elementFromPoint(position.x, position.y);
      //console.log(realTarget);
      //https://ghostinspector.com/blog/simulate-drag-and-drop-javascript-casperjs/
      //http://stackoverflow.com/questions/12396635/crossing-over-to-new-elements-during-touchmove
      ///var elements = document.querySelectorAll(':hover');
      //http://stackoverflow.com/questions/8813051/determine-which-element-the-mouse-pointer-is-on-top-of-in-javascript

      var sortComponents = this.get('sortComponents');
      var activeDropTargets = Ember.A();
      //http://stackoverflow.com/questions/18804592/javascript-foreach-loop-on-associative-array-object
      for (var key in sortComponents) {
        sortComponents[key].forEach((component, index, enumerable) => {
          let item = '#' + component.get('elementId');

          //http://stackoverflow.com/questions/12396635/crossing-over-to-new-elements-during-touchmove
          //If the dragged object is within bounds on the component, the add a class that it is a valid drop target.
          if (!(
        position.x <= $(item).offset().left || position.x >= $(item).offset().left + $(item).outerWidth() ||
        position.y <= $(item).offset().top  || position.y >= $(item).offset().top + $(item).outerHeight()
          )) {

            $(item).addClass('sortable-pending-target');
            activeDropTargets.pushObject(component);

          } else {
            $(item).removeClass('sortable-pending-target');
            $(item).removeClass('sortable-activegroup');
            activeDropTargets.removeObject(component);
          }

        });
      }

      //now check and see if there are more than one drop target (nested groups)
      if (activeDropTargets.length > 1)
      {
        activeDropTargets.forEach((component, index, enumerable) => {
          let item = '#' + component.get('elementId');
          if ($( item ).find( '.sortable-pending-target' ).length)
          {
            //this element has a sortable-pending-target child, skip.
            $(item).removeClass('sortable-activegroup');
            return;
          } else {
            this.activeDropGroup = component;
            console.log("active target = "+item);
          }
        });
      } else if (activeDropTargets.length === 1) {
        //dropTarget is the only element in the array
        this.activeDropGroup = activeDropTargets[0];
      } else {
        //error, no dropTarget found. We can be inbetween drop targets at this point
        this.activeDropGroup = null;
      }

      //Indicate which is the active group in CSS. If null/false then we are inbetween the groups
      if(this.activeDropGroup)
      {
        $('#' + this.activeDropGroup.get('elementId')).addClass('sortable-activegroup');
      }

      this.coordinate();
    },

    getXY(event) {
      let originalEvent = event.originalEvent;
      let touches = originalEvent && originalEvent.changedTouches;
      let touch = touches && touches[0];

      if (touch) {
        return {x:touch.screenX, y:touch.screenY};
      } else {
        return {x:event.pageX, y:event.pageY};
      }
    },

});
