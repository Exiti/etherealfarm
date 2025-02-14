/*
Ethereal Farm
Copyright (C) 2020-2021  Lode Vandevenne

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

// opt_transcend: if true, use alternate background color to indicate it'll transcend with it
function renderBlueprint(b, flex, opt_index, opt_transcend) {
  flex.clear();
  flex.div.style.backgroundColor = opt_transcend ? '#ff7' : '#edc';

  if(!b) b = new BluePrint();
  var w = b.numw;
  var h = b.numh;

  var ratio = h ? (w / h) : 1;
  var grid = new Flex(flex, [0.5, 0, -0.5, ratio], [0.5, 0, -0.5, 1/ratio], [0.5, 0, 0.5,ratio], [0.5,0, 0.5, 1/ratio]);

  for(var y = 0; y < h; y++) {
    for(var x = 0; x < w; x++) {
      var cell = new Flex(grid, x / w, y / h, (x + 1) / w, (y + 1) / h);
      var t = b.data[y][x];
      var c = crops[BluePrint.toCrop(t)];
      if(c) {
        var canvas = createCanvas('0%', '0%', '100%', '100%', cell.div);
        renderImage(c.image[4], canvas);
      }
    }
  }

  if(!b.numw || !b.numh) {
    centerText2(grid.div);
    grid.div.textEl.innerText = '[empty]';
  }

  var name = b.name;
  //if(!name && opt_index != undefined) name = 'blueprint ' + opt_index;

  if(name) {
    var nameFlex = new Flex(flex, 0, -0.1, 1, 0);
    nameFlex.div.innerText = name + ':';
  }

  var name2 = 'blueprint';
  if(opt_index != undefined) name2 += ' ' + opt_index;
  if(b.name) name2 += ': ' + b.name;
  var text = createBluePrintText(b);


  flex.div.setAttribute('aria-description', name2 + ': ' + text);
}

// if allow_override is true, overrides all non-matching crops, but keeps matching ones there
// if allow_override is false, will not replace any existing crop on the field
function plantBluePrint(b, allow_override) {
  if(!b || b.numw == 0 || b.numh == 0) return;

  var wither_incomplete = state.challenge == challenge_wither && state.challenges[challenge_wither].completed < 3;
  if(wither_incomplete) {
    showMessage('blueprints are disabled during the wither challenge, for now...', C_INVALID);
    return;
  }

  // match up corners such that standard tree position overlap, in case field sizes are different
  // treex and treey are coordinates of the stem
  var treex0 = Math.floor((state.numw - 1) / 2);
  var treey0 = Math.floor(state.numh / 2);
  var treex1 = Math.floor((b.numw - 1) / 2);
  var treey1 = Math.floor(b.numh / 2);
  var sx = treex1 - treex0;
  var sy = treey1 - treey0;
  var w = b.numw;
  var h = b.numh;
  var single = false;
  if(w == 1 && h == 1) {
    w = state.numw;
    h = state.numh;
    single = true; // special case: 1x1 blueprint fills entire field
  }
  var did_something = false;
  for(var y = 0; y < h; y++) {
    for(var x = 0; x < w; x++) {
      var f, t, fx, fy;
      if(single) {
        f = state.field[y][x];
        t = b.data[0][0];
        fx = x;
        fy = y;
      } else {
        fx = x - sx;
        fy = y - sy;
        if(fx < 0 || fy < 0 || fx >= state.numw || fy >= state.numh) continue;
        f = state.field[fy][fx];
        t = b.data[y][x];
      }
      var c = crops[BluePrint.toCrop(t)];
      var c2 = undefined;
      if(!c) continue;
      if(allow_override) {
        if(f.index != 0 && f.index != FIELD_REMAINDER) {
          c2 = f.getCrop();
          if(!c2) continue; // field has something, but not crop (e.g. tree), so continue
          if(c2.type == c.type) continue; // keep same types
        }
      } else {
        // don't overwrite anything that already exists on the field
        // that includes existing blueprint spots: if you want to combine blueprints, start from the smallest one, then bigger one to fill in the remaining gaps, not the opposite
        // reason: automaton may already start building up blueprint, so combining the opposite way (overwrite blueprint tiles) may not work due to already becoming real plants
        if(f.index != 0 && f.index != FIELD_REMAINDER) continue;
      }
      if(!state.crops[c.index].unlocked) continue;
      var action_type = !!c2 ? ACTION_REPLACE : ACTION_PLANT;
      addAction({type:action_type, x:fx, y:fy, crop:c, shiftPlanted:false, silent:true});
      did_something = true;
    }
  }
  if(did_something) showMessage('Planted blueprint');
  else showMessage('This blueprint had no effect on the current field');
}

// set a blueprint to empty if it has only 0-cells
function sanitizeBluePrint(b) {
  if(!b) return;
  var w = b.numw;
  var h = b.numh;

  for(var y = 0; y < h; y++) {
    for(var x = 0; x < w; x++) {
      if(b.data[y][x] != 0) return; // has content, nothing to do
    }
  }

  b.numw = 0;
  b.numh = 0;
  b.data = [];
}

function createBluePrintText(b) {
  var text = '';
  if(b) {
    var w = b.numw;
    var h = b.numh;
    for(var y = 0; y < h; y++) {
      for(var x = 0; x < w; x++) {
        var c = BluePrint.toChar(b.data[y][x]);
        text += c;
      }
      text += '\n';
    }
  }
  return text;
}

function exportBluePrint(b) {
  var text = createBluePrintText(b);
  showExportTextDialog('export blueprint', text, 'blueprint-' + util.formatDate(util.getTime(), true) + '.txt', false);
}

function getBluePrintTypeHelpText() {
  var squirreltext = '';
  //if(state.crops2[squirrel2_0].unlocked) squirreltext = 'S=squirrel, ';

  var nutstext = '';
  if(state.crops[nut_0].unlocked) nutstext = 'U=nuts, ';

  return 'B=berry, M=mushroom, F=flower, N=nettle, H=beehive, I=mistletoe, W=watercress/brassica, ' + squirreltext + nutstext + '.=empty/tree';
}

function importBluePrintDialog(fun) {
  var w = 500, h = 500;
  var dialog = createDialog(false, function(e) {
    var shift = e.shiftKey;
    var text = area.value;
    fun(text);
  }, 'import', undefined, 'cancel');
  var textFlex = new Flex(dialog.content, 0.01, 0.01, 0.99, 0.1, 0.4);
  var squirreltext = '';
  if(state.crops2[squirrel2_0].unlocked) squirreltext = 'S=squirrel, ';
  textFlex.div.innerHTML = 'Import blueprint. Case insensitive. ' + getBluePrintTypeHelpText() + '.';
  var area = util.makeAbsElement('textarea', '1%', '15%', '98%', '70%', dialog.content.div);
  area.select();
  area.focus();
}

// this is an extra layer of undo for the undo button on the blueprint editing dialog. Normally that button only does what you are currently doing while that dialog is open
// but this extra function here allows to also use it when re-opening the dialog, at least if no other edits were done yet
var lastpreundoblueprint = undefined;
var lastpreundoblueprintindex = -1;


function createBlueprintDialog(b, opt_index, opt_onclose) {
  if(!haveAutomaton()) return;

  var did_edit = false;

  var orig = b;
  b = BluePrint.copy(b);

  var dialog = createDialog(undefined, function() {
    if(did_edit) {
      b = BluePrint.copy(orig);
      renderBlueprint(b, renderFlex, opt_index);
      did_edit = false;
    } else if(!!lastpreundoblueprint && lastpreundoblueprintindex == opt_index) {
      b = BluePrint.copy(lastpreundoblueprint);
      renderBlueprint(b, renderFlex, opt_index);
      did_edit = true;
    }
    return true;
  }, 'undo', function() {
    // this actually commits the change of the blueprint. This is the cancel function of the dialog: the only thing that does not commit it, is using undo.
    if(did_edit) {
      lastpreundoblueprint = BluePrint.copy(orig);
      lastpreundoblueprintindex = opt_index;
      BluePrint.copyTo(b, orig);
    }
  }, 'ok', undefined, undefined, undefined, opt_onclose, undefined, undefined, undefined, /*swap_buttons=*/true);

  var renderFlex = new Flex(dialog.content, [0, 0, 0.05], [0, 0, 0.05], [0, 0, 0.5], [0, 0, 0.5]);
  renderBlueprint(b, renderFlex, opt_index);


  var y = 0.5;
  var addButton = function(text, fun, tooltip) {
    var h = 0.055;
    var button = new Flex(dialog.content, [0, 0, 0.05], y, [0.5, 0, 0.05], y + h, 0.8).div;
    y += h * 1.1;
    styleButton(button);
    button.textEl.innerText = text;
    addButtonAction(button, fun);
    if(tooltip) registerTooltip(button, tooltip);
  };

  addButton('To field', function(e) {
    plantBluePrint(b, false);
    BluePrint.copyTo(b, orig); // since this closes the dialog, remember it like the ok button does
    closeAllDialogs();
    update();
  }, 'Plant this blueprint on the field. Only empty spots of the field are overridden, existing crops will stay, even if their type differs.');

  addButton('To field, overriding', function(e) {
    plantBluePrint(b, true);
    BluePrint.copyTo(b, orig); // since this closes the dialog, remember it like the ok button does
    closeAllDialogs();
    update();
  }, 'Plant this blueprint on the field. Existing crops from the field are also deleted and overridden, if their type differs and the blueprint is non-empty at that spot.');

  addButton('From field', function() {
    var w = state.numw;
    var h = state.numh;
    b.numw = w;
    b.numh = h;
    b.data = [];
    for(var y = 0; y < h; y++) {
      b.data[y] = [];
      for(var x = 0; x < w; x++) {
        var f = state.field[y][x];
        b.data[y][x] = BluePrint.fromCrop(f.getCrop());
      }
    }
    sanitizeBluePrint(b);
    renderBlueprint(b, renderFlex, opt_index);
    did_edit = true;
  }, 'Save the current field state into this blueprint. You can use the cancel button below to undo this.');

  addButton('To TXT', function() {
    exportBluePrint(b);
  }, 'Export the blueprint to text format, for external storage and sharing');

  addButton('From TXT', function() {
    importBluePrintDialog(function(text) {
      if(text == '') return;
      text = text.trim();
      var s = text.split('\n');
      var h = s.length;
      if(h < 1 || h > 11) return;
      var w = 0;
      for(var i = 0; i < h; i++) w = Math.max(w, s[i].length);
      if(w < 1) return;
      if(w > 11) w = 11;
      b.numw = w;
      b.numh = h;
      b.data = [];
      for(var y = 0; y < h; y++) {
        b.data[y] = [];
        for(var x = 0; x < w; x++) {
          b.data[y][x] = BluePrint.fromChar(s[y][x]);
        }
      }
      sanitizeBluePrint(b);
      renderBlueprint(b, renderFlex, opt_index);
      did_edit = true;
    });
  }, 'Import the blueprint from text format, as generated with To TXT. You can use the cancel button below to undo this.');

  addButton('Rename', function() {
    makeTextInput('Enter new blueprint name, or empty for default', function(name) {
      b.name = sanitizeName(name);
      renderBlueprint(b, renderFlex, opt_index);
      did_edit = true;
    });
  }, 'Rename this blueprint. This name shows up in the main blueprint overview. You can use the cancel button below to undo this.');

  addButton('Delete blueprint', function() {
    b.numw = 0;
    b.numh = 0;
    b.data = [];
    b.name = '';
    renderBlueprint(b, renderFlex, opt_index);
    did_edit = true;
  }, 'Delete this blueprint. You can use the cancel button below to undo this.');

  addButton('Help', function() {
    showBluePrintHelp();
  });

  return dialog;
}

function showBluePrintHelp() {
  var dialog = createDialog();

  var titleDiv = new Flex(dialog.content, 0.01, 0.01, 0.99, 0.1, 0.4).div;
  centerText2(titleDiv);
  titleDiv.textEl.innerText = 'Blueprint help';

  var flex = new Flex(dialog.content, 0.01, 0.11, 0.99, 1, 0.3);
  var div = flex.div;
  makeScrollable(flex);

  var text = '';

  text += 'Blueprint allow planting a whole field layout at once, and storing layouts';
  text += '<br/><br/>';
  text += 'A field layout represents a crop type for each tile. Crop types are for example berry, mushroom, flower, nettle, ... A layout never refers to a specific crop, such as blackberry or blueberry, only to the type (here "berry") in general.';
  text += '<br/><br/>';
  text += 'Planting a blueprint places crop templates on the field. You can also plant individual crop templates yourself using the regular plant dialog.';
  text += '<br/><br/>';
  text += 'The blueprint will only plant templates on empty field cells, when a field cell already has something (including another template) it is not overplanted.';
  text += '<br/><br/>';
  text += 'If the blueprint and field have a different size, it still just works and plants anything it can that is not out of bounds, centered around the tree. The tree is not present in the blueprint itself, it assumes where the standard position of a field of that size is.';
  text += '<br/><br/>';
  text += 'To create a blueprint, you can use two methods:';
  text += '<br/>';
  text += ' • From field: the current field layout is copied to the blueprint, e.g. wherever there\'s any berry on the field, produces a berry template in the blueprint.';
  text += '<br/>';
  text += ' • From text (TXT): Write a field layout on multiple lines of text using the following letters: ' + getBluePrintTypeHelpText() + '. Export TXT does the opposite.';
  text += '<br/><br/>';
  text += 'Keyboard shotcuts for blueprints:';
  text += '<br/>';
  text += 'Note: on mac, ctrl means command instead.';
  text += '<br/>';
  text += ' • "b": open the blueprint dialog';
  text += '<br/>';
  text += ' • "u": when mouse hovering over blueprint template: upgrade template to highest crop tier you can afford of that type';
  text += '<br/>';
  text += ' • shift + click blueprint in main blueprint dialog: plant it immediately rather than opening its editing dialog (if not empty)';
  text += '<br/>';
  text += ' • ctrl + click blueprint in main blueprint dialog: plant it immediately and override differing plants on the field';
  text += '<br/>';
  text += ' • shift + click "To Field" button of a blueprint: plant it immediately and override differing crops on the field';
  text += '<br/>';
  text += ' • "t", "b": open transcend dialog, and then open transcend-with-blueprint dialog';
  text += '<br/><br/>';
  text += 'Once automaton is advanced enough, it can also use blueprints.';

  div.innerHTML = text;
}

var blueprintdialogopen = false;

// opt_transcend: if true, then creates a blueprint dialog where if you click the blueprint, it transcends and plants that blueprint immediately, but that doesn't allow editing the blueprints
function createBlueprintsDialog(opt_transcend) {
  if(!haveAutomaton()) return;

  var challenge_button_name = undefined;
  var challenge_button_fun = undefined;
  if(opt_transcend) {
    challenge_button_name = 'challenges';
    if(state.untriedchallenges) challenge_button_name = 'challenges\n(new!)';
    challenge_button_fun = function(){
      createChallengeDialog();
    };
  }

  blueprintdialogopen = true;
  var dialog = createDialog(undefined, challenge_button_fun, challenge_button_name, undefined, undefined, undefined, undefined, undefined, function() {
    blueprintdialogopen = false;
  });


  var titleFlex = new Flex(dialog.content, 0.01, 0.01, 0.99, 0.1, 0.4);
  centerText2(titleFlex.div);
  if(opt_transcend) {
    titleFlex.div.textEl.innerText = 'Transcend with blueprint';
  } else {
    titleFlex.div.textEl.innerText = 'Blueprint library';
  }

  var bflex = new Flex(dialog.content, [0.01, 0, 0], [0.1, 0, 0], [0.01, 0, 0.98], [0.1, 0, 0.98]);

  for(var i = 0; i < 9; i++) {
    var x = i % 3;
    var y = Math.floor(i / 3);
    var flex = new Flex(bflex, 0.33 * (x + 0.05), 0.33 * (y + 0.05), 0.33 * (x + 0.95), 0.33 * (y + 0.95));
    renderBlueprint(state.blueprints[i], flex, i, opt_transcend);
    styleButton0(flex.div, true);
    addButtonAction(flex.div, bind(function(index, flex, e) {
      for(var i = 0; i <= index; i++) {
        if(!state.blueprints[i]) state.blueprints[i] = new BluePrint();
      }
      var shift = util.eventHasShiftKey(e);
      var ctrl = util.eventHasCtrlKey(e);
      var filled = state.blueprints[index] && state.blueprints[index].numw && state.blueprints[index].numh;
      if(opt_transcend) {
        /*if(!state.allowshiftdelete) {
          showMessage('enable "shortcuts may delete crop" in the preferences before the shortcut to transcend and plant blueprint is allowed', C_INVALID);
        } else*/ if(state.treelevel < min_transcension_level && state.treelevel != 0 && !state.challenge) {
          showMessage('not high enough tree level to transcend (transcend with blueprint tries to transcend first, then plant the blueprint)', C_INVALID);
        } else {
          if(state.challenge) {
            addAction({type:ACTION_TRANSCEND, challenge:0});
          } else {
            if(state.treelevel >= min_transcension_level) addAction({type:ACTION_TRANSCEND, challenge:0});
          }
          addAction({type:ACTION_PLANT_BLUEPRINT, blueprint:state.blueprints[index]});
          closeAllDialogs();
          update();
        }
      } else {
        if(shift && !ctrl && filled) {
          plantBluePrint(state.blueprints[index], false);
          closeAllDialogs();
          update();
        } else if(!shift && ctrl && filled) {
          plantBluePrint(state.blueprints[index], true);
          closeAllDialogs();
          update();
        } else if(shift && ctrl && filled) {
          if(!state.allowshiftdelete) {
            // do nothing: this is a deprecated shortcut, only visible with exact correct usage
            //showMessage('enable "shortcuts may delete crop" in the preferences before the shortcut to transcend and plant blueprint is allowed', C_INVALID);
          } else if(state.treelevel < min_transcension_level && state.treelevel != 0 && !state.challenge) {
            // do nothing: this is a deprecated shortcut, only visible with exact correct usage
            //showMessage('not high enough tree level to transcend (use shift+blueprint to just plant this blueprint)', C_INVALID);
          } else {
            // deprecated feature, but still supported for those who like its convenience of "b" + "ctrl+shift+click" (the alternative is: "t", "b", "click")
            if(state.treelevel >= min_transcension_level) {
              showMessage('Transcended and planted blueprint');
              addAction({type:ACTION_TRANSCEND, challenge:0});
            }
            addAction({type:ACTION_PLANT_BLUEPRINT, blueprint:state.blueprints[index]});
            closeAllDialogs();
            update();
          }
        } else {
          var closefun = bind(function(i, flex) {
            renderBlueprint(state.blueprints[i], flex, index);
          }, index, flex);
          var subdialog = createBlueprintDialog(state.blueprints[index], index, closefun);
        }
      }
    }, i, flex));
  }

  return dialog;
}
