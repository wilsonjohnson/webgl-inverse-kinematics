import {mat2, vec2, vec3, vec4} from 'gl-matrix';
const {sign,max,min} = Math;

function isNode<T>( value: any ): value is Node<T> {
  return typeof value.capacity !== 'undefined';
}

function strokeAbsoluteRect( context: CanvasRenderingContext2D, x: number, y: number, x2: number, y2: number ) {
  context.strokeRect( x, y, x2 - x, y2 - y);
}

export class Node<T> {
  protected top_left: T[] | Node<T> = [];
  protected top_right: T[] | Node<T> = [];
  protected bottom_left: T[] | Node<T> = [];
  protected bottom_right: T[] | Node<T> = [];
  private mid_point: vec2;
  private _length: number = 0;
  private has_split = false;

  constructor(
    protected values: T[],
    protected dimensions: vec4,
    protected position_lookup: (T) => vec2 = i => i,
    protected capacity: number = 10,
    protected max_depth: number = 4,
    protected depth: number = 0
  ) {
    if ( capacity < 2 ) throw 'Capacity too small';
    const start = vec2.fromValues( dimensions[0], dimensions[1] );
    const end = vec2.fromValues( dimensions[2], dimensions[3] );
    this.mid_point = vec2.add(vec2.create(), start, end );
    vec2.scale( this.mid_point, this.mid_point, 0.5 );
    // if ( values.length > this.capacity ) this.split();
    for ( let value of values ) {
      this.push( value );
    }
  }

  public get length(): number {
    return this._length;
  }

  public split() {
    if ( this.depth + 1 < this.max_depth ) {
      // top left
      {
        const dimensions = vec4.fromValues( this.dimensions[0], this.dimensions[1], this.mid_point[0], this.mid_point[1] );
        this.top_left = new Node<T>( this.top_left as T[], dimensions, this.position_lookup, this.capacity, this.max_depth, this.depth + 1 );
      }
      // top right
      {
        const dimensions = vec4.fromValues( this.mid_point[0], this.dimensions[1], this.dimensions[2], this.mid_point[1] );
        this.top_right = new Node<T>( this.top_right as T[], dimensions, this.position_lookup, this.capacity, this.max_depth, this.depth + 1 );
      }
      // bottom left
      {
        const dimensions = vec4.fromValues( this.dimensions[0], this.mid_point[1], this.mid_point[0], this.dimensions[3] );
        this.bottom_left = new Node<T>( this.bottom_left as T[], dimensions, this.position_lookup, this.capacity, this.max_depth, this.depth + 1 );
      }
      // bottom right
      {
        const dimensions = vec4.fromValues( this.mid_point[0], this.mid_point[1], this.dimensions[2], this.dimensions[3] );
        this.bottom_right = new Node<T>( this.bottom_right as T[], dimensions, this.position_lookup, this.capacity, this.max_depth, this.depth + 1 );
      }
    }
    this.has_split = true;
  }

  private increment_length( value: T ) {
    
  }

  public push( value: T ) {
    const position = vec2.clone(this.position_lookup( value ));
    if ( ! this.has_split && this.length > this.capacity) this.split();
    vec2.sub( position, position, this.mid_point );
    const insertion_point = this.get_insertion_point( position );
    if ( !isNode( insertion_point ) ) {
      if ( !insertion_point.some( t => vec2.equals( this.position_lookup(t), this.position_lookup( value ) )) ) {
        this._length = this._length + 1;
      }
    }
    insertion_point.push( value );
  }

  private get_insertion_point( position: vec2 ): Node<T> | T[] {
    const [x,y] = position;
    const [sign_x,sign_y] = [ sign(x), sign(y) ];
    if ( sign_x < 0 && sign_y < 0 ) {
      return this.top_left;
    }
    if ( sign_x >= 0 && sign_y < 0 ) {
      return this.top_right;
    }
    if ( sign_x < 0 && sign_y >= 0 ) {
      return this.bottom_left;
    }
    if ( sign_x >= 0 && sign_y >= 0 ) {
      return this.bottom_right;
    }
  }

  private get start(): vec2 {
    return vec2.from( this.dimensions ) as vec2;
  }
  private get end(): vec2 {
    return vec2.from( this.dimensions.slice( 2, 4 ) ) as vec2;
  }

  public query( bounds: vec4 | number[], found: T[] = [] ): T[] {
    this.query_zone( this.top_left, bounds, found );
    this.query_zone( this.top_right, bounds, found );
    this.query_zone( this.bottom_left, bounds, found );
    this.query_zone( this.bottom_right, bounds, found );
    return found;
  }

  public query_circle( bounds: vec3 | number[], found: T[] = [] ): T[] {
    this.query_zone_circle( this.top_left, bounds, found );
    this.query_zone_circle( this.top_right, bounds, found );
    this.query_zone_circle( this.bottom_left, bounds, found );
    this.query_zone_circle( this.bottom_right, bounds, found );
    return found;
  }

  private query_zone_circle( zone: T[] | Node<T>, bounds:  vec3 | number[], found: T[] ): T[] {
    if ( isNode( zone ) ){
      if ( zone.within_circle( bounds ) ) return zone.query_circle( bounds, found ) ;
    } else {
      for( let value of zone ) {
        if ( this.point_within_circle( this.position_lookup(value), bounds ) ) found.push( value );
      }
    }
    return found;
  }

  private query_zone( zone: T[] | Node<T>, bounds:  vec4 | number[], found: T[] ): T[] {
    if ( isNode( zone ) ){
      if ( zone.within( bounds ) ) return zone.query( bounds, found ) ;
    } else {
      for( let value of zone ) {
        if ( this.point_within( this.position_lookup(value), bounds ) ) found.push( value );
      }
    }
    return found;
  }

  public point_within( point: vec2, bounds: vec4 | number[] ): boolean {
    const [x,y] = point;
    const [_x,_y,_x2,_y2] = bounds;
    const test = (v,v1,v2) => v >= v1 && v <= v2;
    return test(x,_x,_x2) && test(y,_y,_y2);
  }

  public point_within_circle( point: vec2, bounds: vec3 | number[] ): boolean {
    const [x,y] = point;
    const [circle_x,circle_y,r] = bounds;
    let dx = circle_x - x;
    let dy = circle_y - y;
    return (dx ** 2 + dy ** 2) < (r ** 2);
  }

  public within( bounds: vec4 | number[] ): boolean {
    const [x,y,x2,y2] = this.dimensions;
    const [_x,_y,_x2,_y2] = bounds;
    const test = (v,v1,v2) => v >= v1 && v < v2;
    return !(
      _x > x2 ||
      _x2 < x ||
      _y > y2 ||
      _y2 < y
    );
  }

  public within_circle( bounds: vec3 | number[] ): boolean {
    const [x,y,x2,y2] = this.dimensions;
    const [circle_x,circle_y,r] = bounds;
    let dx = circle_x - max(x, min(circle_x, x2));
    let dy = circle_y - max(y, min(circle_y, y2));
    return (dx ** 2 + dy ** 2) < (r ** 2);
  }

  private get width() {
    return this.dimensions[2] - this.dimensions[0];
  }

  private get height() {
    return this.dimensions[3]-this.dimensions[1];
  }

  public draw(context: CanvasRenderingContext2D) {
    context.strokeRect( this.dimensions[0],this.dimensions[1], this.width, this.height );
    // context.fillStyle = 'white';
    // context.beginPath();
    // context.ellipse( this.mid_point[0], this.mid_point[1], 1, 1, 0, 0, Math.PI * 2 );
    // context.fill();
    if ( this.has_split ) {
      if ( isNode(this.top_left) ) this.top_left.draw(context);
      if ( isNode(this.top_right) ) this.top_right.draw(context);
      if ( isNode(this.bottom_left) ) this.bottom_left.draw(context);
      if ( isNode(this.bottom_right) ) this.bottom_right.draw(context);
    }
  }
}

export class QuadTree<T> extends Node<T> {
  constructor(
    values: T[],
    dimensions: vec4,
    position_lookup: (T) => vec2 = i => i,
    capacity: number = 10,
    max_depth: number = 5
  ) {
    super( [...values], dimensions, position_lookup, capacity, max_depth );
  }

  public draw(context: CanvasRenderingContext2D) {
    // context.fillStyle = 'white';
    // context.fillRect( this.dimensions[0],this.dimensions[1],this.dimensions[2],this.dimensions[3]);
    context.strokeStyle = 'white';
    super.draw(context);
  }
}