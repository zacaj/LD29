var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var Detector;
var md5;

var renderer;
var container;
var scene;
var camera;
var world;
var player;
var pressed = {};
var paused = false;
var worldRadius = 100;
var Entity = (function () {
    function Entity() {
        this.R = worldRadius;
        this.speed = 0;
        this.inside = false;
        this.shouldRemove = false;
    }
    Entity.prototype.update = function () {
        this.v.normalize();
        if (this.speed != 0) {
            this.mesh.position.add(this.v.clone().multiplyScalar(this.speed));
            this.right = new THREE.Vector3();
            this.right.crossVectors(this.v, this.mesh.position.clone().normalize()).normalize();
            this.mesh.position.normalize();
            this.v.crossVectors(this.mesh.position, this.right);
            this.mesh.position.multiplyScalar(this.R + this.r * (this.inside ? -1.3 : 1));
            var q = (new THREE.Quaternion().setFromAxisAngle(this.right, (this.inside ? -1 : 1) * -this.speed / (2 * this.r))).multiply(this.mesh.quaternion);
            this.mesh.quaternion.set(q.x, q.y, q.z, q.w);
        }
    };
    Entity.prototype.randomizeVelocity = function () {
        var up = this.mesh.position.clone().normalize();
        var other = new THREE.Vector3(3, 1, 5).normalize();
        if (up.z != 0)
            other.z = (-up.x * other.x - up.y * other.y) / up.z;
        else if (up.x != 0)
            other.x = (-up.z * other.z - up.y * other.y) / up.x;
        else
            other.x = (-up.z * other.z - up.x * other.x) / up.y;
        this.v = other;
        var cross = new THREE.Vector3().crossVectors(up, other);
        var m = new THREE.Matrix4(other.x, other.y, other.z, 0, up.z, up.y, up.z, 0, cross.x, cross.y, cross.z, 0, 0, 0, 0, 1);
        this.mesh.quaternion.setFromRotationMatrix(m);
        this.turn(Math.random() * 2 * Math.PI);
    };
    Entity.prototype.turn = function (radians) {
        var up = this.mesh.position.clone().normalize();
        var q = new THREE.Quaternion();
        q.setFromAxisAngle(up, radians * (this.inside ? -1 : 1));
        this.v.applyQuaternion(q);
        q.multiply(this.mesh.quaternion);
        this.mesh.quaternion.set(q.x, q.y, q.z, q.w);
        this.v.normalize();
        this.mesh.quaternion.normalize();
    };
    Entity.prototype.collide = function (e) {
        if (this.inside != e.inside)
            return false;
        var dx = e.mesh.position.x - this.mesh.position.x;
        var dy = e.mesh.position.y - this.mesh.position.y;
        var dz = e.mesh.position.z - this.mesh.position.z;
        if (dx * dx + dy * dy + dz * dz < (e.r + this.r) * (e.r + this.r))
            return true;
        return false;
    };
    Entity.prototype.die = function () {
        this.shouldRemove = true;
        scene.remove(this.mesh);
    };
    return Entity;
})();

var entities = new Array();
var bulletGeom;
var nBullet = 0;
var Bullet = (function (_super) {
    __extends(Bullet, _super);
    function Bullet(pos, v, friendly, inside, speed) {
        if (typeof speed === "undefined") { speed = 2; }
        _super.call(this);
        this.friendly = false;
        this.life = 40;
        this.r = .6;
        this.speed = speed;
        this.inside = inside;
        this.mesh = makeSphere(this.r, 0, pos.x, pos.y, pos.z, 0xFFFFFF, bulletGeom);
        this.v = v.clone().normalize();
        this.friendly = friendly;

        nBullet++;
    }
    Bullet.prototype.update = function () {
        _super.prototype.update.call(this);
        if (this.friendly) {
            this.r *= 3;
            var len = entities.length;
            for (var i = 0; i < len; ++i) {
                var e = entities[i];
                if (e.mesh && this.collide(e)) {
                    if (e instanceof Enemy) {
                        e.die();
                        this.die();
                        break;
                    }
                }
            }
            this.r /= 3;
        } else if (this.collide(player)) {
            player.die();
            this.die();
        }
        if (this.life-- < 0)
            this.die();
    };
    Bullet.prototype.die = function () {
        if (this.shouldRemove)
            return;
        _super.prototype.die.call(this);
        nBullet--;
    };
    return Bullet;
})(Entity);
;

var particleGeom;
var Particle = (function (_super) {
    __extends(Particle, _super);
    function Particle(p) {
        _super.call(this);
        this.life = 100;
        this.speed = 0;

        scene.add(this.p = particleGeom.clone());
        this.p.position = p.clone();
        nParticle++;
    }
    Particle.prototype.update = function () {
        this.life -= 6;
        if (this.life < 0)
            this.die();
        var s = (Math.sin((1 - this.life / 100) * Math.PI)) * 1.5 / 250;
        this.p.scale.set(s, s, s);

        this.p.material.opacity = Math.sin(this.life / 100 * Math.PI / 2) * .7;
        this.p.material.needsUpdate = true;
    };
    Particle.prototype.die = function () {
        if (this.shouldRemove)
            return;
        nParticle--;
        scene.remove(this.p);
        _super.prototype.die.call(this);
    };
    return Particle;
})(Entity);
var nParticle = 0;
function newEnemy() {
    var rand = Math.random();
    if (rand < .6) {
        return new StupidEnemy();
    } else if (rand < .8) {
        return new HomingEnemy();
    } else if (rand < 1 || true) {
        return new CirclingEnemy();
    }
}
var Enemy = (function (_super) {
    __extends(Enemy, _super);
    function Enemy(r, color) {
        _super.call(this);
        this.value = 100;
        this.age = 0;
        this.r = r;
        var up;
        do {
            up = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize().multiplyScalar(worldRadius + this.r);
        } while(up.clone().sub(player.mesh.position).lengthSq() < 50 * 50);
        this.mesh = makeSphere(this.r, 1, up.x, up.y, up.z, color);
        this.speed = Math.random() * .5 + .4;
        this.randomizeVelocity();
        this.inside = Math.random() > .6;

        var sphereGeom = new THREE.CylinderGeometry(this.r * 1.3, this.r * 1.3, 1000, 7, 1, true);
        var darkMaterialL = new THREE.MeshLambertMaterial({ color: 0x1010FF });
        darkMaterialL.shading = THREE.FlatShading;
        darkMaterialL.wireframe = true;
        darkMaterialL.transparent = true;
        darkMaterialL.opacity = .7;
        darkMaterialL.visible = false;
        this.cyl = new THREE.Mesh(sphereGeom, darkMaterialL);
        this.cyl.quaternion.onChangeCallback = function () {
        };
        this.cyl.position = this.mesh.position;
        scene.add(this.cyl);
    }
    Enemy.prototype.update = function () {
        _super.prototype.update.call(this);

        this.age++;
        if ((this.age > 60 * 15) && this.inside != player.inside) {
            var to = player.mesh.position.clone().sub(this.mesh.position);
            var len = to.lengthSq();
            if (len < 7000) {
                if (this.cyl.material.visible == false) {
                    this.cyl.material.visible = true;
                    this.cyl.material.needsUpdate = true;
                }
                if (len < 900) {
                    var to2 = player.mesh.position.clone().normalize().multiplyScalar(this.mesh.position.length()).sub(this.mesh.position);
                    if (to2.lengthSq() < (this.r * 1.3 + player.r) * (this.r * 1.3 + player.r)) {
                        this.cyl.material.color = new THREE.Color(0xFF0000);
                        player.die();
                        this.die();
                    } else
                        this.cyl.material.color = new THREE.Color(0xFFFFAA);
                    this.cyl.material.wireframe = false;
                    this.cyl.material.opacity = Math.random() * .2 + .8;
                    this.cyl.material.needsUpdate = true;
                } else {
                    if (this.cyl.material.wireframe == false) {
                        this.cyl.material.color = new THREE.Color(0x1010FF);
                        this.cyl.material.wireframe = true;
                    }
                    this.cyl.material.opacity = 1 - (len) / 7000;
                    this.cyl.material.needsUpdate = true;
                }
                this.cyl.position = this.mesh.position.clone().normalize().multiplyScalar(this.R - 500 * (this.inside ? -1 : 1));
                var up = this.mesh.position.clone().normalize().multiplyScalar(-(this.inside ? -1 : 1));
                var fwd = this.v.clone().normalize();
                var right = new THREE.Vector3().crossVectors(fwd, up).clone();
                fwd.negate();
                this.cyl.up = up.clone();
                this.cyl.lookAt(fwd.clone().add(this.cyl.position));
            } else {
                if (this.cyl.material.wireframe == false) {
                    this.cyl.material.color = new THREE.Color(0x7777FF);
                    this.cyl.material.wireframe = true;
                }
                this.cyl.material.visible = false;
            }
        }
        if (player.collide(this)) {
            player.die();
        }
    };

    Enemy.prototype.die = function () {
        if (this.shouldRemove)
            return;
        _super.prototype.die.call(this);
        scene.remove(this.cyl);
        entities.push(new Particle(this.mesh.position));
        if (Math.random() < .3) {
            lastSpawn = new Date().getTime();
            entities.push(newEnemy());
            console.log("die spawned" + (entities.length - nBullet - nParticle));
        }
        nextScore += this.value;
        combo++;
        comboTimeLeft = 30;
        if (this.mesh.position.clone().sub(player.mesh.position).lengthSq() < 100) {
            combo += 5;
            comboTimeLeft += 120;
        }
    };
    return Enemy;
})(Entity);

var diveTime = 0;
var CirclingEnemy = (function (_super) {
    __extends(CirclingEnemy, _super);
    function CirclingEnemy() {
        _super.call(this, 1.7, 0xFFFFFF);
        this.speed = Math.random() * .3 + .4;
        this.distance = Math.random() * 30 + 35;
        this.value = 50;
    }
    CirclingEnemy.prototype.update = function () {
        _super.prototype.update.call(this);
        var to = player.mesh.position.clone().sub(this.mesh.position);
        var to2;
        var toIsLess = to.length() < this.distance;
        var toLength = to.length();
        to2 = player.mesh.position.clone().sub(this.mesh.position.clone().add(this.v));
        var to2Length = to2.length();
        if (toIsLess && to2Length < toLength) {
            this.turn(.05);
            var to3 = player.mesh.position.clone().sub(this.mesh.position.clone().add(this.v));
            var to3Length = to3.length();
            if (to3Length > to2Length) {
            } else {
                this.turn(-.05 * 2);
            }
        }
        if (!toIsLess && toLength < to2Length) {
            this.turn(.05);
            var to3 = player.mesh.position.clone().sub(this.mesh.position.clone().add(this.v));
            var to3Length = to3.length();
            if (to3Length < to2Length) {
            } else {
                this.turn(-.05 * 2);
            }
        }
    };
    return CirclingEnemy;
})(Enemy);
var HomingEnemy = (function (_super) {
    __extends(HomingEnemy, _super);
    function HomingEnemy() {
        _super.call(this, 1.2, 0xFF3333);
        this.speed = .5;
        this.distance = Math.random() * 10 + 25;
        this.value = 200;
    }
    HomingEnemy.prototype.update = function () {
        _super.prototype.update.call(this);
        var to = player.mesh.position.clone().sub(this.mesh.position);
        if (to.length() < 120 && player.inside == this.inside) {
            var ton = to.clone().normalize();
            var cross = new THREE.Vector3().crossVectors(ton, this.v);
            if (to.length() < this.distance) {
                if (this.speed < 1.05)
                    this.speed += .07;
                var rand = Math.random() * .7;
                this.mesh.material.color = new THREE.Color(1, rand, rand);
            } else {
                if (this.speed > .6)
                    this.speed -= .03;
                this.mesh.material.color = new THREE.Color(0xFF3333);
                if ((ton.dot(this.v) < 0 && to.length() < 110) || (ton.dot(this.v) > 0 && to.length() < 45)) {
                } else {
                    if (cross.dot(this.mesh.position.clone().normalize()) < 0)
                        this.turn(.03 * 4);
                    else {
                        this.turn(-.03 * 4);
                    }
                }
            }
        } else {
            if (this.speed > .5)
                this.speed -= .03;
            this.mesh.material.color = new THREE.Color(0xFF3333);
        }
    };
    return HomingEnemy;
})(Enemy);
var StupidEnemy = (function (_super) {
    __extends(StupidEnemy, _super);
    function StupidEnemy() {
        _super.call(this, 1.5, 0x44FF44);
        this.speed = Math.random() * .7 + .2;
    }
    StupidEnemy.prototype.update = function () {
        _super.prototype.update.call(this);
    };
    return StupidEnemy;
})(Enemy);
var Player = (function (_super) {
    __extends(Player, _super);
    function Player() {
        _super.call(this);
        this.cooldown = 0;
        this.visible = true;
        this.dir = new THREE.Vector3();
        this.v = new THREE.Vector3(0, 0, -1);
        this.r = 2;
        this.mesh = makeSphere(this.r, 1, 0, worldRadius + this.r, 0);
        this.mesh.material.wireframe = true;
        this.speed += .2;
        this.inside = false;
    }
    Player.prototype.update = function () {
        _super.prototype.update.call(this);

        if (pressed[87]) {
            this.speed += .6;
        } else if (pressed[83]) {
            this.speed -= .6;
        } else
            this.speed += leftY * .65;
        if (pressed[65]) {
            this.turn(.06);
        } else if (pressed[68]) {
            this.turn(-.06);
        } else if (leftX != 0)
            this.turn(-leftX * .07);

        if (this.speed > 0) {
            this.speed -= .15;
            if (this.speed < 0)
                this.speed = 0;
        } else if (this.speed < 0) {
            this.speed += .15;
            if (this.speed > 0)
                this.speed = 0;
        }

        if (this.speed > 2)
            this.speed = 2;
        if (this.speed < -2)
            this.speed = -2;
        if (this.cooldown > 0)
            this.cooldown--;
        var dir = new THREE.Vector3();
        if (pressed[73] == true || pressed[38])
            dir.y += 1;
        if (pressed[74] == true || pressed[37])
            dir.x -= 1;
        if (pressed[75] == true || pressed[40])
            dir.y -= 1;
        if (pressed[76] == true || pressed[39])
            dir.x += 1;
        if (dir.x == 0 && dir.y == 0) {
            dir.x = rightX;
            dir.y = rightY;
        }
        if (dir.x == 0 && dir.y == 0)
            this.dir.set(0, 0, 0);
        else {
            dir.normalize().multiplyScalar(.1);
            this.dir.multiplyScalar(.1);
            this.dir.add(dir);
            this.dir.normalize();

            this.dir.normalize().multiplyScalar(3).add(new THREE.Vector3(Math.random() * .3 - .15, Math.random() * .3 - .15, 0));
            if (this.cooldown == 0 && this.dir.lengthSq() > .1) {
                var up = this.mesh.position.clone().normalize().multiplyScalar((this.inside ? -1 : 1));
                var fwd = this.v.clone();
                var right = new THREE.Vector3().crossVectors(this.v, up);
                var d = fwd.multiplyScalar(this.dir.y).add(right.multiplyScalar(this.dir.x)).add(this.v.clone().multiplyScalar(this.speed));
                var bullet = new Bullet(this.mesh.position, d, true, this.inside, d.length());
                if (this.visible)
                    bullet.mesh.material.wireframe = true;
                else
                    bullet.mesh.material.visible = false;
                this.visible = !this.visible;
                entities.push(bullet);
                this.cooldown = 1;
            }
        }
    };
    Player.prototype.die = function () {
        if (new Date().getTime() - diveTime < 500)
            return;
        _super.prototype.die.call(this);

        document.getElementById('content').innerHTML = "game over :(<br><br><input type='text' name='name' id='name' value='" + getItem('name') + "'></input><br><button type='button' onclick='submitScore()'>Submit score</button><br>" + '<br><br><input type="button" value="Restart" onClick="window.location.reload()"><br>(or press Space)';

        document.onkeydown = function (e) {
            if (e.keyCode == 32) {
                window.location.reload();
            }
            ;
        };
        paused = true;
    };
    return Player;
})(Entity);
function makeSphere(r, d, x, y, z, color, geom) {
    if (typeof color === "undefined") { color = 0xFFFFFF; }
    if (typeof geom === "undefined") { geom = null; }
    var sphereGeom;
    if (geom)
        sphereGeom = geom.clone();
    else {
        sphereGeom = new THREE.IcosahedronGeometry(r, d);
    }

    var darkMaterialL = new THREE.MeshLambertMaterial({ color: color });
    darkMaterialL.shading = THREE.FlatShading;

    var w = new THREE.Mesh(sphereGeom, darkMaterialL);
    w.quaternion.onChangeCallback = function () {
    };
    w.position.set(x, y, z);
    scene.add(w);
    return w;
}

var temp;
var lights = new Array();
function startGame() {
    scene = new THREE.Scene();

    var SCREEN_WIDTH = 800, SCREEN_HEIGHT = 600;
    var VIEW_ANGLE = 55, ASPECT = SCREEN_WIDTH / SCREEN_HEIGHT, NEAR = 0.1, FAR = 20000;
    camera = new THREE.PerspectiveCamera(VIEW_ANGLE, ASPECT, NEAR, FAR);
    scene.add(camera);
    camera.position.set(0, 0, 400);
    camera.lookAt(scene.position);

    if (Detector.webgl)
        renderer = new THREE.WebGLRenderer({ antialias: false });
    else
        renderer = new THREE.CanvasRenderer();
    renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
    container = document.getElementById('content');
    renderer.domElement.id = 'renderer';
    container.appendChild(renderer.domElement);

    world = makeSphere(100, 3, 0, 0, 0, 0x101010AA);
    world.material.opacity = .9;
    world.material.transparent = true;
    world.material.side = THREE.FrontSide;
    document.onkeydown = function (e) {
        if (e.keyCode == 32) {
            player.inside = !player.inside;
            if (player.inside) {
                world.material.side = THREE.BackSide;
                world.material.opacity = .85;
                world.material.needsUpdate = true;
            } else {
                world.material.side = THREE.FrontSide;
                world.material.opacity = .9;
                world.material.needsUpdate = true;
            }
            if (player.speed == 0)
                player.speed = .0001;
            diveTime = new Date().getTime();
            e.preventDefault();
        }
        pressed[e.keyCode] = true;
        if (e.keyCode >= 37 && e.keyCode <= 40)
            e.preventDefault();
    };

    document.onkeyup = function (e) {
        delete pressed[e.keyCode];
    };

    entities.push(player = new Player());
    for (var i = 0; i < 20; i++)
        entities.push(newEnemy());

    var light = new THREE.PointLight(0xffffff, 1, 5000);
    light.position.set(0, 1, .3);
    scene.add(light);
    lights.push(light);
    var light2 = new THREE.DirectionalLight(0xffffff, .05);
    light2.position.set(1, .3, .5);
    scene.add(light2);
    lights.push(light2);
    var light2 = new THREE.DirectionalLight(0xffffff, .05);
    light.position.set(-1, .3, .5);
    scene.add(light2);
    lights.push(light2);
    var light2 = new THREE.DirectionalLight(0xffffff, .05);
    light.position.set(0, -.7, -.3);
    scene.add(light2);
    lights.push(light2);
    setInterval(update, 16);
    temp = makeSphere(4, 2, 0, 0, 0, 0xFF00FF);
    scene.add(makeParticles(500, 0xFF3333, 20, worldRadius + 15));
    particleGeom = makeParticles(250, 0xFF4444);
    bulletGeom = new THREE.IcosahedronGeometry(.6, 0);

    ready2();
}
var lastSpawn = 0;
var start = new Date().getTime();
var combo = 0;
var comboTimeLeft = -1;
var score = 0;
var nextScore = 0;
var addScore = 0;
var lastScore = 0;
function update() {
    if (addScore > 0) {
        var change = Math.floor(Math.max(Math.floor(lastScore / 40), 1));
        score += change;
        addScore -= change;
    } else
        lastScore = 0;
    if (comboTimeLeft > 0)
        comboTimeLeft--;
    if (comboTimeLeft == 0) {
        addScore += Math.floor(nextScore * combo);
        lastScore = addScore;
        nextScore = 0;
        combo = 0;
        comboTimeLeft = -1;
    }
    document.getElementById('score').innerHTML = "" + score;
    document.getElementById('addScore').innerHTML = "" + (addScore > 0 ? (" +" + addScore) : "");
    document.getElementById('nextScore').innerHTML = "" + (nextScore > 0 ? ("+" + nextScore) : "");
    document.getElementById('combo').innerHTML = "" + (combo > 1 ? (" x" + combo) : "");
    if (paused)
        return;
    for (var i = 0; i < entities.length; i++) {
        entities[i].update();
        if (entities[i].shouldRemove) {
            entities.splice(i, 1);
            i--;
        }
    }
    var enemyCount = entities.length - nParticle - nBullet;
    if (Math.random() > ((Math.cos(((1 - enemyCount / 110) * Math.PI / 2 + Math.PI / 2)) * .03 + .96))) {
        lastSpawn = new Date().getTime();
        entities.push(newEnemy());
        console.log("spawned" + enemyCount);
    }
    var pos = player.mesh.position.clone();
    pos.sub(player.v.clone().multiplyScalar(30 * (player.inside ? 2.3 : 1))).add(pos.clone().normalize().multiplyScalar((player.inside ? -.8 : 1) * 50));
    camera.position = pos.clone().add(new THREE.Vector3(1, 1, 1));
    camera.up = player.mesh.position.clone().normalize().multiplyScalar((player.inside ? -1 : 1));
    camera.lookAt(player.mesh.position.clone().add(player.v.clone().multiplyScalar(11 * (player.inside ? .9 : .8))));
    lights[0].position = pos.clone().add(player.v.clone().multiplyScalar(20));
    renderer.render(scene, camera);
}
function makeParticles(r, color, size, innerRadius) {
    if (typeof size === "undefined") { size = 20; }
    if (typeof innerRadius === "undefined") { innerRadius = 0; }
    var particleCount = 500, particles = new THREE.Geometry(), pMaterial = new THREE.ParticleSystemMaterial({
        color: color,
        size: size,
        map: THREE.ImageUtils.loadTexture("particle.png"),
        blending: THREE.AdditiveBlending,
        transparent: true
    });

    for (var p = 0; p < particleCount; p++) {
        var pX = Math.random() * 2 - 1, pY = Math.random() * 2 - 1, pZ = Math.random() * 2 - 1, particle = (new THREE.Vector3(pX, pY, pZ).multiplyScalar((r - innerRadius) + innerRadius));

        particles.vertices.push(particle);
    }

    var particleSystem = new THREE.ParticleSystem(particles, pMaterial);

    particleSystem.sortParticles = true;
    return particleSystem;
}

var leftX = 0, leftY = 0, rightX = 0, rightY = 0;
function ready2() {
    var gamepad = new Gamepad();

    gamepad.bind(Gamepad.Event.CONNECTED, function (device) {
        console.log('Connected', device);
    });

    gamepad.bind(Gamepad.Event.DISCONNECTED, function (device) {
        console.log('Disconnected', device);
    });

    gamepad.bind(Gamepad.Event.BUTTON_DOWN, function (e) {
        var gamepad = e.gamepad;

        var first = e.control.charAt(0);
        if (first == 'F') {
            player.inside = !player.inside;
            if (player.inside) {
                world.material.side = THREE.BackSide;
                world.material.opacity = .85;
                world.material.needsUpdate = true;
            } else {
                world.material.side = THREE.FrontSide;
                world.material.opacity = .9;
                world.material.needsUpdate = true;
            }
            if (player.speed == 0)
                player.speed = .0001;
            diveTime = new Date().getTime();
        }
        if (e.control == 'DPAD_UP')
            pressed[87] = true;
        if (e.control == 'DPAD_DOWN')
            pressed[83] = true;
        if (e.control == 'DPAD_LEFT')
            pressed[65] = true;
        if (e.control == 'DPAD_RIGHT')
            pressed[68] = true;
        if (e.control.substr(0, 4) == 'STAR')
            window.location.reload();
    });

    gamepad.bind(Gamepad.Event.BUTTON_UP, function (e) {
        var gamepad = e.gamepad;
        var first = e.control.charAt(0);
        if (e.control == 'DPAD_UP')
            delete pressed[87];
        if (e.control == 'DPAD_DOWN')
            delete pressed[83];
        if (e.control == 'DPAD_LEFT')
            delete pressed[65];
        if (e.control == 'DPAD_RIGHT')
            delete pressed[68];
    });
    gamepad.bind(Gamepad.Event.AXIS_CHANGED, function (e) {
        if (Math.abs(e.value) < .15) {
            e.value = 0;
        }
        if (e.axis == 'LEFT_STICK_X')
            leftX = e.value;
        if (e.axis == 'LEFT_STICK_Y')
            leftY = -e.value;
        if (e.axis == 'RIGHT_STICK_X')
            rightX = e.value;
        if (e.axis == 'RIGHT_STICK_Y')
            rightY = -e.value;
    });

    if (!gamepad.init()) {
        document.getElementById('directions').innerHTML += "gamepad init failed";
    } else {
        document.getElementById('controller').style.display = '';
    }
}
