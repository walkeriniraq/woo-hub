(function($) {

    var _isFormDirty = false;

    $.fn.cleanFormDirt = function() {
      _isFormDirty = false;
    }

    $.fn.getAddEventForm = function(id, secret, callback) {
        if (id && secret) {
            // TODO: loading spinner
            $.ajax({
                url: '/api/retrieve_event.php?id=' + id + "&secret=" + secret,
                type: 'GET',
                success: function(data) {
                    data.secret = secret;
                    data.readComic = true;
                    data.codeOfConduct = true;
                    populateEditForm( data, callback );
                },
                error: function(data) {
                    callback( data.responseJSON.error.message );
                }
            });
        } else {
            populateEditForm({ datestatuses: [] }, callback);
        }
    };

    function populateEditForm(shiftEvent, callback) {
        var i, h, m, meridian,
            displayHour, displayMinute, timeChoice,
            template, rendered, item,
            lengths = [ '0-3', '3-8', '8-15', '15+'],
            audiences = [{code: 'F', text: 'Family friendly. Adults bring children.'},
                         {code: 'G', text: 'General. For adults, but kids welcome.'},
                         {code: 'A', text: '21+ only.'}],
            areas = [{code: 'P', text: 'Portland'},
                {code: 'V', text: 'Vancouver'}];

        shiftEvent.lengthOptions = [];
        for ( i = 0; i < lengths.length; i++ ) {
            item = {range: lengths[i]};
            if (shiftEvent.length == lengths[i]) {
                item.isSelected = true;
            }
            shiftEvent.lengthOptions.push(item);
        }

        shiftEvent.timeOptions = [];
        meridian = 'AM';
        for ( h = 0; h < 24; h++ ) {
            for ( m = 0; m < 60; m += 15 ) {
                if ( h > 11 ) {
                    meridian = 'PM';
                }
                if ( h === 0 ) {
                    displayHour = 12;
                } else if ( h > 12 ) {
                    displayHour = h - 12;
                } else {
                    displayHour = h;
                }
                displayMinute = m;
                if ( displayMinute === 0 ) {
                    displayMinute = '00';
                }
                timeChoice = {
                    time: displayHour + ':' + displayMinute + ' ' + meridian,
                    value: h + ':' + displayMinute + ':00'
                };
                if (h < 10) {
                    timeChoice.value = '0' + timeChoice.value;
                }
                if (shiftEvent.time === timeChoice.value) {
                    timeChoice.isSelected = true;
                }
                shiftEvent.timeOptions.push(timeChoice);
            }
        }
        shiftEvent.timeOptions.push({ time: "11:59 PM" });
        if (!shiftEvent.time) {
            // default to 5:00pm if not set;
            // 0 = 12:00am, 1 = 12:15am, 2 = 12:30am, ... 68 = 5:00pm
            shiftEvent.timeOptions[68].isSelected = true;
        }

        if (!shiftEvent.audience) {
            shiftEvent.audience = 'G';
        }
        shiftEvent.audienceOptions = [];
        for ( i = 0; i < audiences.length; i++ ) {
            if (shiftEvent.audience == audiences[i].code) {
                audiences[i].isSelected = true;
            }
            shiftEvent.audienceOptions.push(audiences[i]);
        }

        if (!shiftEvent.area) {
            shiftEvent.area = 'P';
        }
        shiftEvent.areaOptions = [];
        for ( i = 0; i < areas.length; i++ ) {
            if (shiftEvent.area == areas[i].code) {
                areas[i].isSelected = true;
            }
            shiftEvent.areaOptions.push(areas[i]);
        }

        template = $('#mustache-edit').html();
        rendered = Mustache.render(template, shiftEvent);
        callback(rendered);

        $('#date-select').setupDatePicker(shiftEvent['datestatuses'] || []);

        if (shiftEvent['datestatuses'].length === 0) {
            $('.save-button').prop('disabled', true);
            $('.preview-button').prop('disabled', true);
        }

        if (shiftEvent.published) {
          $('.published-save-button').show();
          $('.duplicate-button').show();

          // show the user's selected image after they select it:
          // first, attach to the input button.
          $('#image').on("change", function(evt) {
            const img = $("img.event-image"); // the actual img element
            const input = evt.target;
            const file = input.files && input.files[0];
            // was a file selected and is it an okay size?
            if (!file || (file.size > 1024*1024*2)) {
              // worst comes to worst, it will show an broken image
              // which the user would also see as an error.
              img.attr("src", "/img/cal/icons/image.svg");
            } else {
              const reader = new FileReader();
              reader.onload = function(next) {
                img.attr("src", next.target.result);
              };
              reader.readAsDataURL(file);
            }
          });
        }

        $('.save-button, .publish-button').click(function() {
            var postVars,
                isNew = !shiftEvent.id;
            $('.form-group').removeClass('has-error');
            $('[aria-invalid="true"]').attr('aria-invalid', false);
            $('.help-block').remove();
            $('.save-result').removeClass('text-danger').text('');
            postVars = eventFromForm();
            if (!isNew) {
                postVars['id'] = shiftEvent.id;
            }
            var data = new FormData();
            $.each($('#image')[0].files, function(i, file) {
                data.append('file', file);
            });
            data.append('json', JSON.stringify(postVars));
            var opts = {
                type: 'POST',
                url: '/api/manage_event.php',
                contentType: false,
                processData: false,
                cache: false,
                data: data,
                success: function(returnVal) {
                    if (returnVal.published) {
                        $('.unpublished-event').remove();
                        $('.published-save-button').show();
                        $('.duplicate-button').show();
                        _isFormDirty = false;
                    }
                    if (!isNew) {
                      $('#success-message').text('Your event has been updated!');
                      $('#success-modal').modal('show');
                    } else {
                        let newUrl = 'event-submitted';
                        history.pushState({}, newUrl, newUrl);
                        // hide the edit button on the page
                        $('.edit-buttons').prop('hidden', true);
                        // set the text of the page
                        $('#mustache-html').html('<p>Event submitted! Check your email to finish publishing your event.</p><p><a href="/calendar/">See all upcoming events</a> or <a href="/addevent/">add another event</a>.</p>');
                        _isFormDirty = false;
                        $('#submit-email').text(postVars.email);
                        $('#submit-modal').modal('show');
                    }
                    shiftEvent.id = returnVal.id;
                },
                error: function(returnVal) {
                    var err, okGroups, errGroups;

                    // get the error message:
                    if (returnVal.responseJSON) {
                      err = returnVal.responseJSON.error;
                    } else if (returnVal.status === 413) {
                      // 413 - "Request Entity Too Large" gets sent by nginx above its client_max_body_size;
                      // so the error message sent by flourish.
                      err = {
                        message: 'There were errors in your fields',
                        fields: {
                          file: 'The file uploaded is over the limit of 2.0 M',
                        }
                      };
                    } else {
                      err = {
                       message: 'Server error saving event!'
                      };
                    }
                    // munge the "file" errors to be "image" errors
                    // so that the error message shows on proper line.
                    // tbd: we also change this in manage_event.php
                    if (err.fields && err.fields.file && !err.fields.image) {
                      err.fields.image = err.fields.file;
                    }

                    // process the errors:
                    $('.save-result').addClass('text-danger').text(err.message);

                    $.each(err.fields, function(fieldName, message) {
                        var input = $('[name=' + fieldName + ']'),
                            parent = input.closest('.form-group,.checkbox'),
                            label = $('label', parent);
                        input.attr('aria-invalid', true);
                        parent
                            .addClass('has-error')
                            .append('<div class="help-block">' + message + '</div>');
                        $('.help-block .field-name', parent).text(
                            label.text().toLowerCase()
                        );
                    });

                    // Collapse groups without errors, show groups with errors
                    errGroups = $('.has-error').closest('.panel-collapse');
                    okGroups = $('.panel-collapse').not(errGroups);
                    errGroups.collapse('show');
                    okGroups.collapse('hide');
                    $('.preview-edit-button').click();
                }
            };
            if(data.fake) {
                opts.xhr = function() { var xhr = jQuery.ajaxSettings.xhr(); xhr.send = xhr.sendAsBinary; return xhr; }
                opts.contentType = "multipart/form-data; boundary="+data.boundary;
                opts.data = data.toString();
            }
            $.ajax(opts);
        });

        $(document).off('click', '.preview-button')
            .on('click', '.preview-button', function(e) {
            previewEvent(shiftEvent, function(eventHTML) {
                // first, find the edit image
                const img = $(".event-image");
                // render the new html preview:
                const out = $('#mustache-html');
                out.append(eventHTML);
                // copy the image source from the edit image to the preview:
                const imgPreview = out.find('img.lazy');
                imgPreview.attr("src", img.attr("src"));
                imgPreview.removeClass("lazy");
            });
        });

        $(document).off('click', '.duplicate-button')
            .on('click', '.duplicate-button', function(e) {
            shiftEvent.id = '';
            shiftEvent.secret = '';
            shiftEvent.datestatuses = [];
            shiftEvent.image = '';
            shiftEvent.codeOfConduct = false;
            shiftEvent.readComic = false;
            populateEditForm(shiftEvent, function(eventHTML) {
                var newUrl = '/addevent/';
                history.pushState({}, newUrl, newUrl);
                $('#mustache-html').empty().append(eventHTML);
                $('html, body').animate({
                  scrollTop: 0
                }, 1000)
            });
        });

        checkForChanges();
    }

    function previewEvent(shiftEvent, callback) {
        var previewEvent = {},
            mustacheData;
        var $form = $('#event-entry');
        $.extend(previewEvent, shiftEvent, eventFromForm());

        previewEvent['displayStartTime'] = previewEvent['time'];
        if ( previewEvent['eventduration'] ){
            var endTime = moment(previewEvent['time'], 'hh:mm A')
                .add(previewEvent['eventduration'], 'minutes')
                .format('HH:mm');
            previewEvent['endtime'] = endTime; // e.g. 18:00
            previewEvent['displayEndTime'] = moment(endTime, 'HH:mm').format('h:mm A'); // e.g. 6:00 PM
        }

        previewEvent['audienceLabel'] = $form.getAudienceLabel(previewEvent['audience']);
        previewEvent['length'] += ' miles';
        previewEvent['mapLink'] = $form.getMapLink(previewEvent['address']);
        previewEvent['webLink'] = $form.getWebLink(previewEvent['weburl']);
        previewEvent['contactLink'] = $form.getContactLink(previewEvent['contact']);

        $form.hide();
        mustacheData = {
            dates:[],
            preview: true,
            expanded: true
        };
        $.each(previewEvent.datestatuses, function(index, value) {
            var date = $form.formatDate(value['date']);
            var displayDate = $form.formatDate(value['date'], abbreviated=true);
            var newsflash = value['newsflash'];
            var cancelled = (value['status'] === 'C');
            mustacheData.dates.push({
                date: date,
                displayDate: displayDate,
                newsflash: newsflash,
                cancelled: cancelled,
                caldaily_id: index,
                events: [previewEvent],
            });
        });
        $('.preview-button').hide();
        $('.preview-edit-button').show();
        var template = $('#view-events-template').html();
        var info = Mustache.render(template, mustacheData);
        callback(info);
    }

    function eventFromForm() {
        var harvestedEvent = {};
        $('form').serializeArray().map(function (x) {
            harvestedEvent[x.name] = x.value;
        });
        harvestedEvent['datestatuses'] = $('#date-picker').dateStatusesList();
        return harvestedEvent;
    }

    // Set up email error detection and correction
    $( document ).on( 'blur', '#email', function () {
        $( this ).mailcheck( {
            suggested: function ( element, suggestion ) {
                var template = $( '#email-suggestion-template' ).html(),
                    data = { suggestion: suggestion.full },
                    message = Mustache.render( template, data );
                $( '#email-suggestion' )
                    .html( message )
                    .show();
            },
            empty: function ( element ) {
                $( '#emailMsg' )
                    .hide();
            }
        } );
    } );

    $( document ).on( 'click', '#email-suggestion .correction', function () {
        $( '#email' ).val( $( this ).text() );
        $( '#email-suggestion' )
            .hide();
    } );

    $( document ).on( 'click', '#email-suggestion .glyphicon-remove', function () {
        $( '#email-suggestion' )
            .hide();
        // They clicked the X button, turn mailcheck off
        // TODO: Remember unwanted corrections in local storage, don't offer again
        $( document ).off( 'blur', '#email' );
    } );

    function checkForChanges() {
        $(':input').on('input', function () {
          _isFormDirty = true;
        });
        // this doesn't detect changes in the date picker yet;
        // TODO more checks to listen for changes there

        window.addEventListener('beforeunload', function (e) {
          if (_isFormDirty) {
            e.preventDefault();
            e.returnValue = '';
          }
        });
        return 0;
    };

}(jQuery));
