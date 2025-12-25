/**
 * Vocabulary Explorer with Local File Picker
 * Based on BBIH Vocabulary jsTree view
 * Modified to load vocabulary files via browser file picker (no server needed)
 */

var synSelector = '.usedFor, .relatedTerm, .usedFor-multi, .usedFor-multi-factor';
var treeSelector = '#tobias-jsTree';
var synVisible = true;
var synLookup = {};
var searchresults = null;

$(document).ready(function(){
    
    // File input change handler
    $('#vocab-file-input').on('change', function(e) {
        var file = e.target.files[0];
        if (file) {
            loadVocabularyFile(file);
        }
    });

    // Button click triggers file input
    $('#file-picker-btn').on('click', function() {
        $('#vocab-file-input').click();
    });

    // "Load different file" button
    $('#load-new-file').on('click', function() {
        resetExplorer();
    });

    // Drag and drop support
    var dropZone = $('#file-picker-container');
    
    dropZone.on('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).addClass('drag-over');
    });

    dropZone.on('dragleave', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).removeClass('drag-over');
    });

    dropZone.on('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).removeClass('drag-over');
        
        var files = e.originalEvent.dataTransfer.files;
        if (files.length > 0) {
            loadVocabularyFile(files[0]);
        }
    });
});

function loadVocabularyFile(file) {
    if (!file.name.match(/\.html?$/i)) {
        showError('Please select an HTML file (.html or .htm)');
        return;
    }

    $('#file-name-display').text('Loading: ' + file.name + '...');
    $('#load-error').hide();

    var reader = new FileReader();
    
    reader.onload = function(e) {
        var content = e.target.result;
        
        if (!content.includes('<ul>') || !content.includes('class="term"')) {
            showError('This file does not appear to be a valid vocabulary HTML file.');
            return;
        }

        $('#file-name-display').text('Loaded: ' + file.name);
        initializeTree(content);
    };

    reader.onerror = function() {
        showError('Error reading file. Please try again.');
    };

    reader.readAsText(file);
}

function showError(message) {
    $('#load-error').text(message).show();
    $('#file-name-display').text('');
}

function resetExplorer() {
    if ($.jstree.reference(treeSelector)) {
        $(treeSelector).jstree('destroy');
    }
    
    synLookup = {};
    searchresults = null;
    synVisible = true;
    
    $('#file-picker-container').removeClass('hidden');
    $('#sticky-header').addClass('hidden');
    $(treeSelector).empty();
    $('#vocab-file-input').val('');
    $('#file-name-display').text('');
    $('#load-error').hide();
    $('#search-input').val('');
    $('#breadcrumb').html('');
}


//----------------------------------------------------------
// Initialize jsTree - KEY FIX: inject HTML into DOM first
//----------------------------------------------------------
function initializeTree(htmlContent) {
    $('#file-picker-container').addClass('hidden');
    $('#sticky-header').removeClass('hidden');

    // KEY FIX: Insert the HTML directly into the container
    // jstree will then parse the existing DOM structure
    $(treeSelector).html(htmlContent);

    // Now initialize jstree on the container with existing HTML
    $(treeSelector)
    .on('ready.jstree before_open.jstree', function (e, data) {
      if (synVisible == false) {
        $(this).find(synSelector).hide();
      } else {
        $(this).find(synSelector).show();
      }
      $(this).find('ul > li').each(function () {
        $(this).find('span.relatedTerm').first().addClass('parenFirst');
        $(this).find('span.relatedTerm').last().addClass('parenLast');
      });
    })
    .on('model.jstree', function (e, data) {
      data.nodes.forEach(function(i) {
        $('<div/>').html(data.instance.get_node(i).text)
        .find(synSelector).each(function() {
          var currNids = synLookup[$(this).text()] || [];
          currNids.push(i);
          synLookup[$(this).text()] = currNids;
        });
      });
    })
    .on('activate_node.jstree', function (e, data) {
      var node = data.node;

      if (!$(treeSelector).jstree(true).is_selected(node)) {
        if (searchresults) {
          $('#breadcrumb').html('Found ' + searchresults.length + ' matches.');
        } else {
          $('#breadcrumb').html('');
        }
        return;
      }

      var nodeIds = $(treeSelector).jstree(true).get_path(node, false, true);
      var breadcrumb = [];

      nodeIds.forEach(function(id) {
        var n = $(treeSelector).jstree(true).get_node(id).text;
        var t = $('<div />').append($.parseHTML(n)).find('span.term').text();
        breadcrumb.push('<a data-jstree-id="'+ id +'" href="javascript:void(0)">'+ t +'</a>');
      });

      $('#breadcrumb').html(breadcrumb.join(' &gt; '));
    })
    .on('search.jstree', function (e, data) {
      searchresults = data.nodes;
      $('#search-input').removeClass('loading');
      $('#breadcrumb').html('Found ' + searchresults.length + ' matches.');
    })
    .on('clear_search.jstree', function (e, data) {
      searchresults = null;
      $('#search-input').removeClass('loading');
      $('#breadcrumb').html('');
    })
    .jstree({
      'core': {
        'multiple' : false,
        'themes': {
          'name': 'proton',
          'responsive': true,
          'icons' : false,
        },
      },
      'types' : {
        'default' : { 'icon' : '' },
        'usedFor' : { 'icon' : 'glyphicon glyphicon-ok' },
      },
      'plugins' : [ 'types', 'search' ],
    });

    // Setup tooltips
    $(treeSelector).on('mouseenter', synSelector, function (event) {
        $(this).qtip({
            overwrite: false,
            show: {
                event: 'click',
                solo: true,
                effect: function() { $(this).slideDown(100); }
            },
            content: {
              text: getTooltipContent(this),
              title: getTooltipTitle(this),
            },
            position: { my: 'top left', at: 'bottom left' },
            hide: { event: 'unfocus', fixed: true },
            style: { classes: 'qtip-bootstrap qtip-shadow' },
        });
    });

    $('#toggleSyns').off('click').on('click', function() {
      $(synSelector).toggle();
      synVisible = !synVisible;
    });

    $("#search-input").off('keyup').on('keyup', function() {
      var context = this;
      $(context).addClass('loading');

      if(!$(context).val()) {
        $(treeSelector).jstree(true).clear_search();
        return;
      }

      clearTimeout($.data(this, 'timer'));
      var wait = setTimeout(function() {
        $(treeSelector).jstree(true).search($(context).val(), true);
      }, 1000);
      $(this).data('timer', wait);
    });

    var $window = $(window),
        $sticky = $('#sticky-header'),
        stickyTop = $sticky.offset().top;
    $window.off('scroll.sticky').on('scroll.sticky', function() {
      $sticky.toggleClass('sticky', $window.scrollTop() + 10 > stickyTop);
    });
}


//----------------------------------------------------------
// Tooltip helper functions
//----------------------------------------------------------
function getTooltipTitle (obj) {
  if ($(obj).hasClass('usedFor-multi')) {
    return 'Use <em>one or more</em> of these terms:';
  } else if ($(obj).hasClass('usedFor-multi-factor')) {
    return 'Use <strong>ALL</strong> of these terms:';
  } else if ($(obj).hasClass('relatedTerm')) {
    return 'Consider these additional terms:';
  }
  return null;
}

var synNode = null;
function getTooltipContent (obj) {
  var synText = $(obj).text();
  synNode = $(obj).closest('li.jstree-node');

  if ($(obj).hasClass('usedFor-multi') ||
      $(obj).hasClass('usedFor-multi-factor') ||
      $(obj).hasClass('relatedTerm')) {

    var nodeIds = synLookup[synText] || [];
    var nodes = {};
    nodeIds.forEach(function(id) {
      var n = $(treeSelector).jstree(true).get_node(id).text;
      var t = $('<div />').append($.parseHTML(n)).find('span.term').text();
      nodes[id] = t;
    });

    var tipContent = '<ul>';
    for(var index in nodes) {
      if (index == $(synNode).attr('id')) {
        tipContent += '<li><em>'+ nodes[index] +'</em></li>';
      } else {
        tipContent += '<li><a data-jstree-id="'+ index +'" href="javascript:void(0)">'+ nodes[index] +'</a></li>';
      }
    }
    tipContent += '</ul>';
    return tipContent;
  }

  return '"<em>' + $(obj).prevAll('.term').text() + '</em>" is the preferred term.';
}

//----------------------------------------------------------
// Click handler for tooltip hyperlinks
//----------------------------------------------------------
$(document).on('click', 'a[data-jstree-id]', function() {
  $(treeSelector).jstree(true).activate_node($(this).data('jstree-id'));
  var nid = '#' + $(this).data('jstree-id');

  $('html, body').animate({
    scrollTop: $(nid).offset().top - 200
  }, 500);
});
