<?php
namespace OCA\Video_Converter\Controller;

use OCP\IRequest;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\AppFramework\Http\DataResponse;
use OCP\AppFramework\Controller;
use \OCP\IConfig;
use OCP\EventDispatcher\IEventDispatcher;
use OC\Files\Filesystem;


class ConversionController extends Controller {

        private $userId;

        /**
        * @NoAdminRequired
        */
        public function __construct($AppName, IRequest $request, $UserId){
                parent::__construct($AppName, $request);
                $this->userId = $UserId;

        }

        public function getFile($directory, $fileName){
                \OC_Util::tearDownFS();
                \OC_Util::setupFS($this->userId);
                return Filesystem::getLocalFile($directory . '/' . $fileName);
        }
        /**
        * @NoAdminRequired
        */
        public function convertHere($nameOfFile, $directory, $external, $type, $preset, $priority, $movflags = false, $sdrflags = false, $codec = null, $vbitrate = null, $scale = null, $shareOwner = null, $mtime = 0) {
                $file = $this->getFile($directory, $nameOfFile);
                $dir = dirname($file);
                $response = array();
                if (file_exists($file)){
                        $cmd = $this->createCmd($file, $preset, $type, $priority, $movflags, $sdrflags, $codec, $vbitrate, $scale);
                        exec($cmd, $output,$return);
                        // if the file is in external storage, and also check if encryption is enabled
                        if($external || \OC::$server->getEncryptionManager()->isEnabled()){
                                //put the temporary file in the external storage
                                Filesystem::file_put_contents($directory . '/' . pathinfo($nameOfFile)['filename'].".".$type, file_get_contents(dirname($file) . '/' . pathinfo($file)['filename'].".".$type));
                                // check that the temporary file is not the same as the new file
                                if(Filesystem::getLocalFile($directory . '/' . pathinfo($nameOfFile)['filename'].".".$type) != dirname($file) . '/' . pathinfo($file)['filename'].".".$type){
                                        unlink(dirname($file) . '/' . pathinfo($file)['filename'].".".$type);
                                }
                        }else{
                                //create the new file in the NC filesystem
                                Filesystem::touch($directory . '/' . pathinfo($file)['filename'].".".$type);
                        }
                        //if ffmpeg is throwing an error
                        if($return == 127){
                                $response = array_merge($response, array("code" => 0, "desc" => "ffmpeg is not installed or available \n
                                DEBUG(".$return."): " . $file . ' - '.$output));
                                return json_encode($response);
                        }else{
                                $response = array_merge($response, array("code" => 1));
                                return json_encode($response);
                        }
                }else{
                        $response = array_merge($response, array("code" => 0, "desc" => "Can't find file at ". $file));
                        return json_encode($response);
                }
        }
        /**
        * @NoAdminRequired
         */
        public function createCmd($file, $preset, $output, $priority, $movflags, $sdrflags, $codec, $vbitrate, $scale){
                $middleArgs = "";
                if ($output == "webm"){
                        switch ($codec)  {
                                case 'vpx':
                                        $middleArgs = "-vcodec libvpx -quality best";
                                        break;
                                case 'vpx-vp9':
                                        $middleArgs = "-vcodec libvpx-vp9";
                                        break;
                                default:
                                        $middleArgs = "-vcodec libvpx -quality good";
                                        break;
                        }
                        switch ($preset) {
                                case 'faster':
                                        $middleArgs = $middleArgs." -cpu-used 1 -threads 12";
                                        break;
                                case 'veryfast':
                                        $middleArgs = $middleArgs." -cpu-used 2 -threads 12";
                                        break;
                                case 'superfast':
                                        $middleArgs = $middleArgs." -cpu-used 4 -threads 12";
                                        break;
                                case 'ultrafast':
                                        $middleArgs = $middleArgs." -cpu-used 5 -threads 12 -deadline realtime";
                                        break;
                                default:
                                        break;
                        }
                        /** if ($sdrflags) {
                                $middleArgs = $middleArgs." -vf format=yuv420p ";
                        }*/
                        if ($vbitrate != null) {
                                switch ($vbitrate) {
                                        case '1':
                                                $vbitrate = '1000k';
                                                break;
                                        case '2':
                                                $vbitrate = '2000k';
                                                break;
                                        case '3':
                                                $vbitrate = '3000k';
                                                break;
                                        case '4':
                                                $vbitrate = '4000k';
                                                break;
                                        case '5':
                                                $vbitrate = '5000k';
                                                break;
                                        case '6':
                                                $vbitrate = '6000k';
                                                break;
                                        case '7':
                                                $vbitrate = '7000k';
                                                break;
                                        default :
                                                $vbitrate = '2000k';
                                                break;
                                }
                                $middleArgs = $middleArgs." -b:v ".$vbitrate;
                        }
                } else {
                        if ($codec != null){
                                switch ($codec) {
                                        case 'x264':
                                                $middleArgs = "-vcodec libx264 -preset ".escapeshellarg($preset). " -strict -2";
                                                break;
                                        case 'x265':
                                                $middleArgs = "-vcodec libx265 -preset ".escapeshellarg($preset). " -strict -2";
                                                break;
                                        case 'av1':
                                                $middleArgs = "-vcodec libaom-av1 -cpu-used 6 -strict -2 -row-mt 1 -threads 12";
                                                break;
                                }
                        } else {
                                $middleArgs = "-preset ".escapeshellarg($preset). " -strict -2";
                        }
                        if ($movflags == "true") {
                                $middleArgs = $middleArgs." -movflags +faststart ";
                        }
                        if ($sdrflags == "true" ) {
                                $middleArgs = $middleArgs." -vf zscale=t=linear:npl=550,format=gbrpf32le,tonemap=tonemap=mobius:desat=0,zscale=p=bt709:t=bt709:m=bt709:r=tv,format=yuv420p ";
                        }
                        if ($vbitrate != null) {
                                switch ($vbitrate) {
                                        case '1':
                                                $vbitrate = '1000k';
                                                break;
                                        case '2':
                                                $vbitrate = '2000k';
                                                break;
                                        case '3':
                                                $vbitrate = '3000k';
                                                break;
                                        case '4':
                                                $vbitrate = '4000k';
                                                break;
                                        case '5':
                                                $vbitrate = '5000k';
                                                break;
                                        case '6':
                                                $vbitrate = '6000k';
                                                break;
                                        case '7':
                                                $vbitrate = '7000k';
                                                break;
                                        default :
                                                $vbitrate = '2000k';
                                                break;
                                }
                                $middleArgs = $middleArgs." -b:v ".$vbitrate;
                        }

                        if ($scale != null) {
                                switch ($scale) {
                                        case 'vga':
                                                $scale = " -vf scale=640:480";
                                                break;
                                        case 'wxga':
                                                $scale = " -vf scale=1280:720";
                                                break;
                                        case 'hd':
                                                $scale = " -vf scale=1368:768";
                                                break;
                                        case 'fhd':
                                                $scale = " -vf scale=1920:1080";
                                                break;
                                        case 'uhd':
                                                $scale = " -vf scale=3840:2160";
                                                break;
                                        case '320':
                                                $scale = " -vf scale=-1:320";
                                                break;
                                        case '480':
                                                $scale = " -vf scale=-1:480";
                                                break;
                                        case '600':
                                                $scale = " -vf scale=-1:600";
                                                break;
                                        case '720':
                                                $scale = " -vf scale=-1:720";
                                                break;
                                        case '1080':
                                                $scale = " -vf scale=-1:1080";
                                                break;
                                        default:
                                                $scale = "";
                                                break;
                                }
                                $middleArgs = $middleArgs.$scale;
                        }
                }
                //echo $link;
                // I put this here because the code up there seems to be chained in a string builder and I didn't want to disrupt the code too much.
                // This is useful if you just want to change containers types, and do no work with codecs. So you can convert an MKV to MP4 almost instantly.
                if($codec == "copy"){
                        $middleArgs = "-codec copy";
                }
                if($codec == "qsv"){
                //      $cmd = " ffmpeg -y -init_hw_device qsv -qsv_device \/dev\/dri\/renderD128 -c:v hevc_qsv -i ".escapeshellarg($file)." -c:v h264_qsv -profile:v high -vf 'format=nv12,hwupload=extra_hw_frames=16' ".escapeshellarg(dirname($file) . '/' . pathinfo($file)['filename'].".".$output);
                        $cmd = " ffmpeg -y -init_hw_device qsv -c:v hevc_qsv -i ".escapeshellarg($file)." -c:a copy -c:v h264_qsv -profile:v high -global_quality 24 -level 41 -sn -filter_complex 'vpp_qsv=w=1920:h=1080:format=nv12' ".escapeshellarg(dirname($file) . '/' . pathinfo($file)['filename'].".".$output);
                // ffmpeg -init_hw_device qsv -c:v hevc_qsv -i /var/www/html/data/tmp/000_Intro_h265_hdr.MOV -c:v h264_qsv -b:v 5000000 -profile:v high -level 41 -an -sn -vsync -1 -start_at_zero -copyts -avoid_negative_ts 0 -filter_complex "vpp_qsv=w=1920:h=1080:format=nv12" -y output.mp4
                // ffmpeg -init_hw_device qsv -qsv_device /dev/dri/renderD128 -c:v hevc_qsv -i /var/www/html/data/tmp/000_Intro_h265_hdr.MOV -c:v h264_qsv -profile:v high -global_quality 24 -vf 'format=nv12,hwupload=extra_hw_frames=16' -y output.mp4
                } else {
                        $cmd = " ffmpeg -y -i ".escapeshellarg($file)." ".$middleArgs." ".escapeshellarg(dirname($file) . '/' . pathinfo($file)['filename'].".".$output);
                }
                if ($priority != "0"){
                        $cmd = "nice -n ".escapeshellarg($priority).$cmd;
                }
                return $cmd;
        }
}
root@server3:~# expand -t 8 /docker/nextcloud/var/www/html/custom_apps/video_converter/js/conversion.js
$(document).ready(function () {
    var actionsExtract = {
        init: function () {
            OCA.Files.fileActions.registerAction({
                name: 'convert',
                displayName: 'Convert into',
                mime: 'video',
                permissions: OC.PERMISSION_UPDATE,
                type: OCA.Files.FileActions.TYPE_DROPDOWN,
                iconClass: 'icon-convert',
                actionHandler: function (filename, context) {
                    var a = context.$file[0].children[1].children[0].children[0].innerHTML;
                    var b = 'background-repeat:no-repeat;margin-right:1px;display: block;width: 40px;height: 32px;white-space: nowrap;border-image-repeat: stretch;border-image-slice: initial;background-size: 32px;';
                    var position = 30;
                    var output = [a.slice(0, position), b, a.slice(position)].join('');

                    var self = this;
                    var preset = "medium";
                    var priority = "10";
                    var title = "Titre";
                    var vcodec = null;
                    var vbitrate = null;
                    var scaling = null;
                    var faststart = true;
                    var sdr = true;
                    $('body').append(
                        '<div id="linkeditor_overlay" class="oc-dialog-dim"></div>'
                        + '<div id="linkeditor_container" class="oc-dialog" style="position: fixed;">'
                        + '<div id="linkeditor">'
                        + '</div>'
                    );
                    $('#linkeditor').append(
                        '<div class="urledit push-bottom">'
                        + '<a class="oc-dialog-close" id="btnClose"></a>'
                        + '<h2 class="oc-dialog-title" style="display:flex;margin-right:30px;">'
                        + output
                        + filename
                        + '</h2>'
                        + '<div class="sk-circle" style="display:none" id="loading"><div class="sk-circle1 sk-child"></div><div class="sk-circle2 sk-child"></div><div class="sk-circle3 sk-child"></div><div class="sk-circle4 sk-child"></div><div class="sk-circle5 sk-child"></div><div class="sk-circle6 sk-child"></div><div class="sk-circle7 sk-child"></div><div class="sk-circle8 sk-child"></div><div class="sk-circle9 sk-child"></div><div class="sk-circle10 sk-child"></div><div class="sk-circle11 sk-child"></div><div class="sk-circle12 sk-child"></div></div>'
                        + '<div style="text-align:center; display:none; margin-top: 10px;" id="noteLoading">'
                        + '<p>Note: This could take a considerable amount of time depending on your hardware and the preset you chose. You can safely close this window.</p>'
                        + '</div>'
                        + '<div id="params">'
                        + '<p class="vc-label urldisplay" id="labelPreset" style="display:inline-block; margin-right:5px;">'
                        + 'Preset'
                        + '</p>'
                        + '<select id="preset">'
                        + '<option value="ultrafast">UltraFast</option>'
                        + '<option value="superfast">SuperFast</option>'
                        + '<option value="veryfast">VeryFast</option>'
                        + '<option value="faster">Faster</option>'
                        + '<option value="fast">Fast</option>'
                        + '<option value="medium" selected>Medium (default)</option>'
                        + '<option value="slow">Slow</option>'
                        + '<option value="slower">Slower</option>'
                        + '<option value="veryslow">VerySlow</option>'
                        + '</select>'
                        + '<br>'
                        + '<p id="note">Note: faster means worse quality or bigger size</p>'
                        + '<br>'
                        + '<p class="vc-label urldisplay" id="labelPriority" style="display:inline-block; margin-right:5px;">'
                        + 'Priority'
                        + '</p>'
                        + '<select id="priority" style="margin-bottom: 10px;">'
                        + '<option value="-10">High</option>'
                        + '<option value="0">Normal</option>'
                        + '<option value="10" selected>Low (default)</option>'
                        + '</select>'
                        + '<br>'
                        + '<p class="vc-label urldisplay" id="labelCodec" style="display:inline-block; margin-right:5px;">'
                        + 'Codec'
                        + '</p>'
                        + '<select id="vcodec" style="margin-bottom: 10px;">'
                        + '<option value="none">Auto</option>'
                        + '<option value="x264">H264</option>'
                        + '<option value="qsv">QSV</option>'
                        + '<option value="x265">HEVC</option>'
                        + '<option value="vpx">VP8</option>'
                        + '<option value="vpx-vp9">VP9</option>'
                        + '<option value="av1">AV1</option>'
                        + '<option value="copy">Copy</option>'
                        + '</select>'
                        + '<p class="vc-label urldisplay" id="labelBitrate" style="display:inline-block; margin-right:5px;">'
                        + 'Target bitrate'
                        + '</p>'
                        + '<select id="vbitrate" style="margin-bottom: 10px;">'
                        + '<option value="none">Auto</option>'
                        + '<option value="1">1k</option>'
                        + '<option value="2">2k</option>'
                        + '<option value="3">3k</option>'
                        + '<option value="4">4k</option>'
                        + '<option value="5">5k</option>'
                        + '<option value="6">6k</option>'
                        + '<option value="7">7k</option>'
                        + '</select>'
                        + '<p class="vc-label urldisplay" id="labelBitrateUnit" style="display:inline-block; margin-right:5px;">'
                        + 'kbit/s'
                        + '</p>'
                        + '<br>'
                        + '<p class="vc-label urldisplay" id="labelScale" style="display:inline-block; margin-right:5px;">'
                        + 'Scale to'
                        + '</p>'
                        + '<select id="scale" style="margin-bottom: 10px;">'
                        + '<option value="none">Keep</option>'
                        + '<option value="vga">VGA (640x480)</option>'
                        + '<option value="wxga">WXGA (1280x720)</option>'
                        + '<option value="hd">HD (1368x768)</option>'
                        + '<option value="fhd">FHD (1920x1080)</option>'
                        + '<option value="uhd">4K (3840x2160)</option>'
                        + '<option value="320">Keep aspect 320 (Wx320)</option>'
                        + '<option value="480">Keep aspect 480 (Wx480)</option>'
                        + '<option value="600">Keep aspect 600 (Wx600)</option>'
                        + '<option value="720">Keep aspect 720 (Wx720)</option>'
                        + '<option value="1080">Keep aspect 1080 (Wx1080)</option>'
                        + '</select><br>'
                        + '<div class="checkbox-container">'
                        + '<label class="vc-label" for="movflags">Faststart option (for MP4)</label>'
                        + '<input type="checkbox" id="movflags" name="faststart" checked>'
                        + '<br>'
                        + '<label class="vc-label" for="sdrflags">Force SDR</label>'
                        + '<input type="checkbox" id="sdrflags" name="sdr" checked>'
                        + '</div></div>'
                        + '<p class="vc-label urldisplay" id="text" style="display: inline; margin-right: 10px;">'
                        + t('video_converter', 'Choose the output format:')
                        + ' <em></em>'
                        + '</p>'
                        + '<div class="oc-dialog-buttonrow boutons" id="buttons">'
                        + '<a class="button primary" id="mp4">' + t('video_converter', '.MP4') + '</a>'
                        + '<a class="button primary" id="avi">' + t('video_converter', '.AVI') + '</a>'
                        + '<a class="button primary" id="m4v">' + t('video_converter', '.M4V') + '</a>'
                        + '<a class="button primary" id="webm">' + t('video_converter', '.WEBM') + '</a>'
                        + '</div>'
                    );
                    var finished = false;
                    document.getElementById("btnClose").addEventListener("click", function () {
                        close();
                        finished = true;
                    });
                    document.getElementById("preset").addEventListener("change", function (element) {
                        console.log(element.srcElement.value);
                        preset = element.srcElement.value;
                    });
                    document.getElementById("priority").addEventListener("change", function (element) {
                        console.log(element.srcElement.value);
                        priority = element.srcElement.value;
                    });
                    document.getElementById("vcodec").addEventListener("change", function (element) {
                        console.log(element.srcElement.value);
                        vcodec = element.srcElement.value;
                        if (vcodec === "none") {
                            vcodec = null;
                        }
                    });
                    document.getElementById("vbitrate").addEventListener("change", function (element) {
                        vbitrate = element.srcElement.value;
                        if (vbitrate === "none") {
                            vbitrate = null;
                        }
                    });
                    document.getElementById("scale").addEventListener("change", function (element) {
                        scaling = element.srcElement.value;
                        if (scaling === "none") {
                            scaling = null;
                        }
                    });
                    document.getElementById("movflags").addEventListener("change", function (element) {
                        faststart = element.srcElement.checked;
                    });
                    document.getElementById("sdrflags").addEventListener("change", function (element) {
                        sdr = element.srcElement.checked;
                    });
                    document.getElementById("linkeditor_overlay").addEventListener("click", function () {
                        close();
                        finished = true;
                    });
                    var fileExt = filename.split('.').pop();
                    var types = ['avi', 'mp4', 'm4v', 'webm'];
                    types.forEach(type => {
                        if (type == fileExt) {
                            document.getElementById(type).setAttribute('style', 'background-color: lightgray; border-color:lightgray;');
                        } else {
                            document.getElementById(type).addEventListener("click", function ($element) {
                                if (context.fileInfoModel.attributes.mountType == "external") {
                                    var data = {
                                        nameOfFile: filename,
                                        directory: context.dir,
                                        external: 1,
                                        type: $element.target.id,
                                        preset: preset,
                                        priority: priority,
                                        movflags: faststart,
                                        sdrflags: sdr,
                                        codec: vcodec,
                                        vbitrate: vbitrate,
                                        scale: scaling,
                                        mtime: context.fileInfoModel.attributes.mtime,
                                    };
                                } else {
                                    var data = {
                                        nameOfFile: filename,
                                        directory: context.dir,
                                        external: 0,
                                        type: $element.target.id,
                                        preset: preset,
                                        priority: priority,
                                        movflags: faststart,
                                        sdrflags: sdr,
                                        codec: vcodec,
                                        vbitrate: vbitrate,
                                        scale: scaling,
                                        shareOwner: context.fileList.dirInfo.shareOwnerId,
                                    };
                                }
                                var tr = context.fileList.findFileEl(filename);
                                context.fileList.showFileBusyState(tr, true);
                                $.ajax({
                                    type: "POST",
                                    async: "true",
                                    url: OC.filePath('video_converter', 'ajax', 'convertHere.php'),
                                    data: data,
                                    beforeSend: function () {
                                        document.getElementById("loading").style.display = "block";
                                        document.getElementById("noteLoading").style.display = "block";
                                        document.getElementById("params").style.display = "none";
                                        document.getElementById("text").style.display = "none";
                                        document.getElementById("preset").style.display = "none";
                                        document.getElementById("vcodec").style.display = "none";
                                        document.getElementById("vbitrate").style.display = "none";
                                        document.getElementById("scale").style.display = "none";
                                        document.getElementById("labelPreset").style.display = "none";
                                        document.getElementById("labelScale").style.display = "none";
                                        document.getElementById("labelCodec").style.display = "none";
                                        document.getElementById("labelBitrate").style.display = "none";
                                        document.getElementById("labelBitrateUnit").style.display = "none";
                                        document.getElementById("labelPriority").style.display = "none";
                                        document.getElementById("movflags").style.display = "none";
                                        document.getElementById("sdrflags").style.display = "none";
                                        document.getElementById("note").style.display = "none";
                                        document.getElementById("buttons").setAttribute('style', 'display: none !important');
                                    },
                                    success: function (element) {
                                        element = element.replace(/null/g, '');
                                        console.log(element);
                                        response = JSON.parse(element);
                                        if (response.code == 1) {
                                            this.filesClient = OC.Files.getClient();
                                            close();
                                            context.fileList.reload();
                                        } else {
                                            context.fileList.showFileBusyState(tr, false);
                                            close();
                                            OC.dialogs.alert(
                                                t('video_converter', response.desc),
                                                t('video_converter', 'Error converting ' + filename)
                                            );
                                        }
                                    }
                                });
                            });
                        }

                    });
                }
            });

        },
    }

    function close() {
        $('#linkeditor_container').remove();
        $('#linkeditor_overlay').remove();
    }
    actionsExtract.init();
});
