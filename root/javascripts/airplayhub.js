var updateTimer;

$(window).load(function () {
    $.ajax(
        {
            url: 'zones',
            type: "get",
            dataType: "json",
            success: function (data, textStatus, jqXHR) {
                buildControls(data);
            }
        });
    update(true);
});

function update(val) {
    if (val) {
        updateTimer = setInterval(() => {
            $.ajax(
                {
                    url: 'zones',
                    type: "get",
                    dataType: "json",
                    success: function (data, textStatus, jqXHR) {
                        buildControls(data);
                    }
                });
        }, 2000);
    } else {
        clearInterval(updateTimer);
    }
}
function buildControls(data) {
    $('#controls').html('');
    var name;
    for (var i in data) {
        if(data[i].alias) {
            name = data[i].alias;
        } else {
            name = data[i].name;
        }
        $('#controls').append('\r' +
            '       <input id="enabled_' + data[i].name + '" type="checkbox"' + ((data[i].enabled) ? ' checked ' : ' ') + 'class="ios8-switch" />\r' +
            '       <label for="enabled_' + data[i].name + '">' + name + '</label></br></br>\r' +
            ((data[i].fixedvol) ? ((data[i].volupurl) ?
            '       <center>\r' + 
            '           <input type="image" src="/icons/volume-up.png" id="volup_' + data[i].name + '" width="32" height="32" />\r' +
            '           <input type="image" src="/icons/volume-down.png" id="voldown_' + data[i].name + '" width="32" height="32" />\r' +
            '       </center>\r' : '') :
            '       <input type="range" id="volume_' + data[i].name.toLowerCase() + '" value="' + data[i].volume + '" class="range-slider__range" style="width: 100%;">\r') +
            '       </br></br>\r'
        );
    }
    $('[id^=volume_]').on('input', function () {
        update(false);
        $.ajax({ url: '/setvol/' + $(this).attr('id').replace('volume_', '') + '/' + $(this).val() });
        update(true);
    });
    $('[id^=enabled_]').change(function () {
        if (this.checked) {
            $.ajax({ url: '/startzone/' + $(this).attr('id').replace('enabled_', '') });
        } else {
            $.ajax({ url: '/stopzone/' + $(this).attr('id').replace('enabled_', '') });
        }
    });
    $('[id^=volup_]').click(function () {
        update(false);
        for(var i in data) {
            if(data[i].name == $(this).attr('id').replace('volup_', '')) {
                $.ajax({ url: data[i].volupurl });
            }
        }
        update(true);
    });
    $('[id^=voldown_]').click(function () {
        update(false);
        for(var i in data) {
            if(data[i].name == $(this).attr('id').replace('voldown_', '')) {
                $.ajax({ url: data[i].voldownurl });
            }
        }
        update(true);
    });        
}